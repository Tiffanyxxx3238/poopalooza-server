require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('API Key loaded:', process.env.GOOGLE_API_KEY ? '✓' : '✗');

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// 免費模型優先順序
const freeModelPriority = [
  'gemini-2.0',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-pro'
];

let cachedModel = null;
let cachedModelName = null;
let requestCount = 0;
let lastResetTime = Date.now();

// 重置請求計數器
function resetRequestCounter() {
  const now = Date.now();
  if (now - lastResetTime > 60000) {
    requestCount = 0;
    lastResetTime = now;
  }
}

// 格式化 AI 回應
function formatAIResponse(text) {
  return text
    // 移除多餘的星號和格式標記
    .replace(/\*\*\*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '• ')
    
    // 改善分段：移除過多的換行
    .replace(/\n\n\n+/g, '\n\n')
    
    // 確保重要標點符號後有適當換行
    .replace(/([。！？：])\s*([^。！？：\n])/g, '$1\n\n$2')
    
    // 清理列表項目格式
    .replace(/^•\s*/gm, '• ')
    .replace(/^([0-9]+)\.\s*/gm, '$1. ')
    
    // 移除開頭和結尾的多餘空白
    .trim()
    
    // 確保不會有空行在開頭
    .replace(/^\n+/, '')
    
    // 限制連續空行不超過一個
    .replace(/\n{3,}/g, '\n\n');
}

// 生成改善的 prompt
function createEnhancedPrompt(question) {
  // 檢測用戶問題的語言
  const isChinese = /[\u4e00-\u9fff]/.test(question);
  const isJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(question);
  const isKorean = /[\uac00-\ud7af]/.test(question);
  
  let languageInstruction = '';
  let formatRequirements = '';
  
  if (isChinese) {
    languageInstruction = '請用繁體中文回答';
    formatRequirements = `📋 **回答格式要求**：
• 使用清晰簡潔的段落，每段不超過 3 行
• 重要建議用分點列出
• 避免過度使用醫學術語，使用易懂的語言
• 提供實用可行的建議
• 如有嚴重症狀，建議就醫`;
  } else if (isJapanese) {
    languageInstruction = 'Please respond in Japanese';
    formatRequirements = `📋 **回答形式の要件**：
• 明確で簡潔な段落を使用し、各段落は3行以内
• 重要な提案を箇条書きで記載
• 専門用語を避け、分かりやすい言葉を使用
• 実用的で実行可能な提案を提供
• 深刻な症状がある場合は医師の診察を推奨`;
  } else if (isKorean) {
    languageInstruction = 'Please respond in Korean';
    formatRequirements = `📋 **답변 형식 요구사항**：
• 명확하고 간결한 단락 사용, 각 단락은 3줄 이내
• 중요한 제안을 항목별로 나열
• 전문 용어를 피하고 이해하기 쉬운 언어 사용
• 실용적이고 실행 가능한 제안 제공
• 심각한 증상이 있는 경우 의사 진료 권장`;
  } else {
    // 默認英文
    languageInstruction = 'Please respond in English';
    formatRequirements = `📋 **Response Format Requirements**：
• Use clear and concise paragraphs, no more than 3 lines per paragraph
• List important suggestions in bullet points
• Avoid excessive medical terminology, use easy-to-understand language
• Provide practical and actionable advice
• Recommend medical consultation for serious symptoms`;
  }

  return `You are a professional digestive health and lifestyle consultation assistant named PoopBot. ${languageInstruction} and answer user questions about bowel health, diet, exercise, lifestyle habits, and related topics.

${formatRequirements}

👤 **User Question**: ${question}

🩺 **Professional Advice**:`;
}

async function getAvailableModel() {
  for (const modelName of freeModelPriority) {
    try {
      console.log(`🔍 測試免費模型: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const testResult = await model.generateContent('Hello');
      const testResponse = await testResult.response;
      await testResponse.text();
      
      console.log(`✅ 免費模型可用: ${modelName}`);
      return { model, modelName };
    } catch (err) {
      console.log(`❌ 模型 ${modelName} 不可用: ${err.message}`);
      continue;
    }
  }
  throw new Error('❌ 沒有找到可用的免費模型');
}

// 健康檢查端點
app.get('/', (req, res) => {
  res.json({ 
    message: 'Poopalooza AI Assistant API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: ['AI Chat', 'Free Models', 'Rate Limiting', 'Enhanced Formatting']
  });
});

app.post('/api/assistant', async (req, res) => {
  const { question } = req.body;
  
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ answer: 'API Key 未設定' });
  }

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ 
      answer: '請提供有效的問題',
      error: 'Invalid question'
    });
  }

  resetRequestCounter();
  
  if (requestCount >= 10) {
    return res.status(429).json({ 
      answer: '請求太頻繁，請稍後再試。免費版本有使用限制。',
      error: 'Rate limit exceeded',
      retryAfter: 60,
      requestCount: requestCount,
      resetTime: new Date(lastResetTime + 60000).toISOString()
    });
  }
  
  try {
    if (!cachedModel) {
      const result = await getAvailableModel();
      cachedModel = result.model;
      cachedModelName = result.modelName;
    }
    
    console.log(`🤖 使用免費模型: ${cachedModelName} (請求 #${requestCount + 1})`);
    
    requestCount++;
    
    // 使用改善的 prompt
    const enhancedPrompt = createEnhancedPrompt(question.trim());
    
    const result = await cachedModel.generateContent(enhancedPrompt);
    const response = await result.response;
    let answer = response.text();
    
    // 格式化回應
    answer = formatAIResponse(answer);
    
    res.json({ 
      answer,
      model: cachedModelName,
      status: 'success',
      plan: 'free',
      requestCount: requestCount,
      message: '使用免費版本 - 有使用限制',
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('❌ AI 調用錯誤：', err);
    
    if (err.message.includes('quota') || err.message.includes('rate') || err.message.includes('429')) {
      return res.status(429).json({ 
        answer: '免費額度已用完，請稍後再試或考慮升級到付費版本。',
        error: 'Quota exceeded',
        retryAfter: 3600,
        model: cachedModelName,
        plan: 'free'
      });
    }
    
    if (err.message.includes('404') || err.message.includes('NOT_FOUND')) {
      console.log('🔄 嘗試其他免費模型...');
      cachedModel = null;
      cachedModelName = null;
      
      try {
        const result = await getAvailableModel();
        cachedModel = result.model;
        cachedModelName = result.modelName;
        
        const enhancedPrompt = createEnhancedPrompt(question.trim());
        const retryResult = await cachedModel.generateContent(enhancedPrompt);
        const retryResponse = await retryResult.response;
        let answer = retryResponse.text();
        
        answer = formatAIResponse(answer);
        
        return res.json({ 
          answer,
          model: cachedModelName,
          status: 'success_after_retry',
          plan: 'free',
          requestCount: requestCount,
          timestamp: new Date().toISOString()
        });
      } catch (retryErr) {
        console.error('🔄 重試也失敗:', retryErr);
      }
    }
    
    res.status(500).json({ 
      answer: '抱歉，免費的 AI 助手暫時無法使用。請稍後再試或檢查免費額度。',
      error: err.message,
      status: 'error',
      plan: 'free',
      model: cachedModelName,
      timestamp: new Date().toISOString()
    });
  }
});

// 檢查免費模型狀態
app.get('/api/models/free', async (req, res) => {
  const modelStatus = [];
  
  for (const modelName of freeModelPriority) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const testResult = await model.generateContent('test');
      const testResponse = await testResult.response;
      await testResponse.text();
      
      let limits = '';
      if (modelName === 'gemini-1.5-flash') {
        limits = '15 requests/min, 1,500/day';
      } else if (modelName === 'gemini-1.5-pro') {
        limits = '2 requests/min, 50/day';
      } else if (modelName === 'gemini-1.0-pro') {
        limits = '15 requests/min, 1,500/day';
      }
      
      modelStatus.push({ 
        name: modelName, 
        status: '✅ 免費可用',
        available: true,
        limits: limits,
        cost: 'FREE 🎉'
      });
    } catch (err) {
      modelStatus.push({ 
        name: modelName, 
        status: `❌ 不可用: ${err.message}`,
        available: false,
        cost: 'FREE'
      });
    }
  }
  
  res.json({ 
    models: modelStatus,
    plan: 'free',
    note: '所有模型都是免費使用，但有使用限制',
    currentRequests: requestCount,
    resetTime: new Date(lastResetTime + 60000).toISOString(),
    timestamp: new Date().toISOString()
  });
});

// 免費額度使用情況
app.get('/api/usage', (req, res) => {
  resetRequestCounter();
  
  res.json({
    plan: 'free',
    currentRequests: requestCount,
    estimatedLimit: 10,
    resetTime: new Date(lastResetTime + 60000).toISOString(),
    model: cachedModelName || 'Not selected',
    tips: [
      '免費版本有使用限制',
      'Gemini 1.5 Flash 是最佳免費選擇',
      '如需更高限制，請考慮 Google AI Pro',
      '學生可免費獲得 AI Pro 直到2026年期末'
    ],
    timestamp: new Date().toISOString()
  });
});

// 健康檢查端點（詳細版）
app.get('/api/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.GOOGLE_API_KEY;
    
    let modelStatus = 'unknown';
    if (cachedModel && cachedModelName) {
      modelStatus = `active: ${cachedModelName}`;
    } else if (hasApiKey) {
      modelStatus = 'ready to initialize';
    } else {
      modelStatus = 'no api key';
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      apiKey: hasApiKey ? 'configured' : 'missing',
      model: modelStatus,
      requests: {
        current: requestCount,
        resetTime: new Date(lastResetTime + 60000).toISOString()
      },
      endpoints: [
        'GET /',
        'POST /api/assistant',
        'GET /api/models/free',
        'GET /api/usage',
        'GET /api/health'
      ]
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('未處理的錯誤:', err);
  res.status(500).json({
    answer: '伺服器發生錯誤，請稍後再試。',
    error: err.message,
    status: 'error',
    timestamp: new Date().toISOString()
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    error: '端點不存在',
    availableEndpoints: [
      'GET /',
      'POST /api/assistant',
      'GET /api/models/free',
      'GET /api/usage',
      'GET /api/health'
    ],
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 免費 AI Assistant 伺服器啟動於 port ${PORT}`);
  console.log(`📊 免費模型狀態: http://localhost:${PORT}/api/models/free`);
  console.log(`📈 使用情況: http://localhost:${PORT}/api/usage`);
  console.log(`🏥 健康檢查: http://localhost:${PORT}/api/health`);
  console.log(`💡 使用的是完全免費的 Google AI Studio API!`);
  console.log(`🌍 可通過網路訪問`);
  console.log(`📝 已啟用文字格式化功能`);
});
