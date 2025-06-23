require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('API Key loaded:', process.env.GOOGLE_API_KEY ? '✓' : '✗');

const app = express();
app.use(cors());
app.use(express.json()); // 使用內建的 JSON parser 替代 body-parser

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// 免費模型優先順序
const freeModelPriority = [
  'gemini-1.5-flash',      // 免費：15 requests/min, 1M tokens/min, 1,500 requests/day
  'gemini-1.5-pro',        // 免費：2 requests/min, 32K tokens/min, 50 requests/day  
  'gemini-1.0-pro',        // 免費：15 requests/min, 1M tokens/min, 1,500 requests/day
  'gemini-pro'             // 備用免費選項
];

let cachedModel = null;
let cachedModelName = null;
let requestCount = 0;
let lastResetTime = Date.now();

// 重置請求計數器（每分鐘重置）
function resetRequestCounter() {
  const now = Date.now();
  if (now - lastResetTime > 60000) { // 60秒
    requestCount = 0;
    lastResetTime = now;
  }
}

async function getAvailableModel() {
  for (const modelName of freeModelPriority) {
    try {
      console.log(`🔍 測試免費模型: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // 簡單測試請求
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
    features: ['AI Chat', 'Free Models', 'Rate Limiting']
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

  // 重置請求計數器
  resetRequestCounter();
  
  // 檢查請求頻率限制（保守估計）
  if (requestCount >= 10) { // 保守的每分鐘限制
    return res.status(429).json({ 
      answer: '請求太頻繁，請稍後再試。免費版本有使用限制。',
      error: 'Rate limit exceeded',
      retryAfter: 60,
      requestCount: requestCount,
      resetTime: new Date(lastResetTime + 60000).toISOString()
    });
  }
  
  try {
    // 如果還沒有快取模型，獲取可用的免費模型
    if (!cachedModel) {
      const result = await getAvailableModel();
      cachedModel = result.model;
      cachedModelName = result.modelName;
    }
    
    console.log(`🤖 使用免費模型: ${cachedModelName} (請求 #${requestCount + 1})`);
    
    requestCount++;
    
    const result = await cachedModel.generateContent(question.trim());
    const response = await result.response;
    const answer = response.text();
    
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
    
    // 處理額度超出錯誤
    if (err.message.includes('quota') || err.message.includes('rate') || err.message.includes('429')) {
      return res.status(429).json({ 
        answer: '免費額度已用完，請稍後再試或考慮升級到付費版本。',
        error: 'Quota exceeded',
        retryAfter: 3600, // 建議1小時後再試
        model: cachedModelName,
        plan: 'free'
      });
    }
    
    // 如果是模型問題，嘗試其他免費模型
    if (err.message.includes('404') || err.message.includes('NOT_FOUND')) {
      console.log('🔄 嘗試其他免費模型...');
      cachedModel = null;
      cachedModelName = null;
      
      try {
        const result = await getAvailableModel();
        cachedModel = result.model;
        cachedModelName = result.modelName;
        
        const retryResult = await cachedModel.generateContent(question.trim());
        const retryResponse = await retryResult.response;
        const answer = retryResponse.text();
        
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
      
      // 根據模型名稱提供免費額度資訊
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
    estimatedLimit: 10, // 保守估計
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
    // 檢查 API Key
    const hasApiKey = !!process.env.GOOGLE_API_KEY;
    
    // 檢查模型狀態
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

// 使用環境變數或預設端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 免費 AI Assistant 伺服器啟動於 port ${PORT}`);
  console.log(`📊 免費模型狀態: http://localhost:${PORT}/api/models/free`);
  console.log(`📈 使用情況: http://localhost:${PORT}/api/usage`);
  console.log(`🏥 健康檢查: http://localhost:${PORT}/api/health`);
  console.log(`💡 使用的是完全免費的 Google AI Studio API!`);
  console.log(`🌍 可通過網路訪問`);
});