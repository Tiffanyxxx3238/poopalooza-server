require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🚀 啟動免費版 PoopBot API');
console.log('API Key 狀態:', process.env.GOOGLE_API_KEY ? '✅ 已設定' : '❌ 未設定');

if (process.env.GOOGLE_API_KEY) {
  console.log('🔑 API Key 前10字:', process.env.GOOGLE_API_KEY.substring(0, 10) + '...');
  console.log('🔑 API Key 長度:', process.env.GOOGLE_API_KEY.length);
}

const app = express();
app.use(cors());
app.use(express.json());

// ===== App 功能介紹系統 =====
const APP_FEATURES = {
  mainFeatures: {
    zh: [
      "💩 便便記錄：記錄每日排便狀況，包括時間、顏色、形狀、質地",
      "📊 健康分析：視覺化追蹤消化健康趨勢，產生週/月報表",
      "⏰ 智慧提醒：定時提醒喝水、如廁、服用益生菌",
      "🤖 AI 健康助手：24/7 回答消化健康相關問題",
      "🗺️ 廁所地圖：尋找附近公共廁所"
    ],
    en: [
      "💩 Poop Tracking: Record daily bowel movements, time, color, shape, texture",
      "📊 Health Analysis: Visualize digestive health trends with weekly/monthly reports",
      "⏰ Smart Reminders: Timely reminders for water intake and bathroom visits",
      "🤖 AI Health Assistant: 24/7 answers to digestive health questions",
      "🗺️ Toilet Map: Find nearby public toilets"
    ]
  },
  keywords: [
    'app', 'APP', '應用程式', '功能', '介紹', '怎麼用', '如何使用',
    'function', 'feature', 'what', 'how to use', 'help',
    '特色', '特點', '幫助', '什麼用', '做什麼', 'PoopBot'
  ]
};

function detectLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
  return 'en';
}

function isAskingAboutApp(question) {
  const lowerQuestion = question.toLowerCase();
  return APP_FEATURES.keywords.some(keyword => 
    lowerQuestion.includes(keyword.toLowerCase())
  );
}

function generateAppIntro(question) {
  const lang = detectLanguage(question);
  const features = APP_FEATURES.mainFeatures[lang] || APP_FEATURES.mainFeatures.en;
  
  if (lang === 'zh') {
    return `PoopBot App 主要功能：

${features.slice(0, 5).join('\n')}

我們幫你追蹤腸道健康，有問題隨時問我！`;
  } else {
    return `PoopBot App Main Features:

${features.slice(0, 5).join('\n')}

We help you track digestive health. Feel free to ask me any questions!`;
  }
}

// ===== 🔥 優化的 Prompt 生成系統 =====
function createEnhancedPrompt(question, lang) {
  const questionType = detectQuestionType(question);
  
  if (lang === 'zh') {
    // 根據問題類型給予具體指引
    let specificGuidance = '';
    
    if (questionType === 'constipation') {
      specificGuidance = `
針對便秘問題，請務必包含：
1. **立即可做的事**：具體的水量（如300-500ml）、按摩方法、最佳時機
2. **飲食調整**：具體的纖維量（25-30g/天）、推薦食物（燕麥、地瓜等）、益生菌來源
3. **運動建議**：具體的運動類型和時長（如快走30分鐘）
4. **生活習慣**：固定如廁時間、避免憋便
5. **預期效果**：多久會改善（如3-5天）
6. **就醫警訊**：何時必須看醫生（超過1週、血便等）`;
    } else if (questionType === 'diarrhea') {
      specificGuidance = `
針對腹瀉問題，請務必包含：
1. **緊急處理**：電解質補充量（每小時200ml）、BRAT飲食法
2. **飲食建議**：該吃什麼、該避免什麼（具體食物）
3. **恢復階段**：漸進式飲食計畫
4. **預期恢復**：通常需要幾天
5. **就醫時機**：持續3天以上、高燒、血便`;
    } else if (questionType === 'bloating') {
      specificGuidance = `
針對脹氣問題，請包含：
1. **立即緩解**：按摩技巧、姿勢調整
2. **飲食調整**：避免易產氣食物（豆類、碳酸飲料等）
3. **進食習慣**：慢慢吃、避免邊吃邊說話
4. **運動幫助**：促進消化的運動`;
    } else if (questionType === 'hemorrhoids') {
      specificGuidance = `
針對痔瘡問題，請包含：
1. **舒緩方法**：溫水坐浴、冰敷
2. **飲食調整**：增加纖維、多喝水
3. **生活習慣**：避免久坐、如廁不要太用力
4. **何時就醫**：嚴重出血、劇痛`;
    } else {
      specificGuidance = `
請提供：
1. **可能原因分析**（2-3個）
2. **具體改善方法**（包含數字、頻率、時間）
3. **為什麼有效**（簡單解釋原理）
4. **預期效果時間**
5. **何時需要就醫**`;
    }

    return `你是 PoopBot，專業且友善的消化健康助手。

🎯 **核心要求**：
• 給出**具體數字和方法**（例如："每天喝 2000-2500ml 水，分 8-10 次"，而不是籠統的"多喝水"）
• **解釋原理**：告訴用戶為什麼這樣做有效
• **多面向建議**：同時提供飲食、運動、生活習慣的改善方法
• **說明時間表**：告訴用戶多久會見效
• **明確就醫時機**：什麼情況下必須看醫生

${specificGuidance}

👤 **用戶問題**：${question}

🩺 **請用繁體中文提供深入、實用、具體的專業建議**：`;

  } else {
    // 英文版本
    let specificGuidance = '';
    
    if (questionType === 'constipation') {
      specificGuidance = `
For constipation, include:
1. **Immediate actions**: Specific water amount (300-500ml), massage techniques, best timing
2. **Diet changes**: Specific fiber amount (25-30g/day), recommended foods (oatmeal, sweet potato), probiotic sources
3. **Exercise**: Specific types and duration (30-min brisk walk)
4. **Habits**: Regular toilet time, don't hold it in
5. **Timeline**: How long until improvement (3-5 days)
6. **When to see doctor**: Over 1 week, bloody stool, severe pain`;
    } else if (questionType === 'diarrhea') {
      specificGuidance = `
For diarrhea, include:
1. **Emergency care**: Electrolyte replacement amount (200ml/hour), BRAT diet
2. **Diet advice**: What to eat/avoid (specific foods)
3. **Recovery**: Gradual diet plan
4. **Timeline**: Usual recovery time
5. **When to see doctor**: Lasts 3+ days, high fever, bloody stool`;
    } else if (questionType === 'bloating') {
      specificGuidance = `
For bloating, include:
1. **Immediate relief**: Massage, position adjustments
2. **Diet changes**: Avoid gas-producing foods (beans, carbonated drinks)
3. **Eating habits**: Eat slowly, don't talk while eating
4. **Exercise**: Movement that aids digestion`;
    } else if (questionType === 'hemorrhoids') {
      specificGuidance = `
For hemorrhoids, include:
1. **Relief methods**: Warm sitz bath, ice packs
2. **Diet**: Increase fiber, drink more water
3. **Habits**: Avoid prolonged sitting, don't strain
4. **When to see doctor**: Severe bleeding, severe pain`;
    } else {
      specificGuidance = `
Please provide:
1. **Possible causes** (2-3)
2. **Specific solutions** (with numbers, frequency, timing)
3. **Why it works** (simple explanation)
4. **Expected timeline**
5. **When to seek medical care**`;
    }

    return `You are PoopBot, a professional and friendly digestive health assistant.

🎯 **Core Requirements**:
• Provide **specific numbers and methods** (e.g., "drink 2000-2500ml water daily, split into 8-10 servings", not vague "drink more water")
• **Explain mechanisms**: Tell users WHY it works
• **Multi-faceted advice**: Provide diet, exercise, and lifestyle improvements
• **State timelines**: Tell users how long until they see results
• **Clear medical consultation criteria**: When they MUST see a doctor

${specificGuidance}

👤 **User Question**: ${question}

🩺 **Please provide in-depth, practical, specific professional advice in English**:`;
  }
}

function detectQuestionType(question) {
  const lower = question.toLowerCase();
  
  if (lower.includes('便秘') || lower.includes('大不出') || lower.includes('constipat')) {
    return 'constipation';
  }
  if (lower.includes('腹瀉') || lower.includes('拉肚子') || lower.includes('diarrhea') || lower.includes('loose stool')) {
    return 'diarrhea';
  }
  if (lower.includes('脹氣') || lower.includes('bloat') || lower.includes('gas')) {
    return 'bloating';
  }
  if (lower.includes('痔瘡') || lower.includes('hemorrhoid')) {
    return 'hemorrhoids';
  }
  
  return 'general';
}

// ===== 免費額度管理 =====
const USAGE_TRACKER = {
  daily: 0,
  minute: 0,
  lastDailyReset: new Date().toDateString(),
  lastMinuteReset: Date.now(),
  totalRequests: 0,
  failedRequests: 0,
  modelFailures: {}
};

const FREE_LIMITS = {
  perMinute: 5,
  perDay: 50,
  perHour: 20
};

const usageLog = [];

function resetCounters() {
  const now = Date.now();
  const today = new Date().toDateString();
  
  if (today !== USAGE_TRACKER.lastDailyReset) {
    console.log(`📅 每日計數器重置: ${USAGE_TRACKER.daily} -> 0`);
    USAGE_TRACKER.daily = 0;
    USAGE_TRACKER.lastDailyReset = today;
    usageLog.push({
      date: USAGE_TRACKER.lastDailyReset,
      count: USAGE_TRACKER.daily
    });
  }
  
  if (now - USAGE_TRACKER.lastMinuteReset > 60000) {
    USAGE_TRACKER.minute = 0;
    USAGE_TRACKER.lastMinuteReset = now;
  }
}

function canUseAPI() {
  resetCounters();
  
  if (USAGE_TRACKER.daily >= FREE_LIMITS.perDay) {
    return { allowed: false, reason: 'daily_limit', limit: FREE_LIMITS.perDay };
  }
  
  if (USAGE_TRACKER.minute >= FREE_LIMITS.perMinute) {
    return { allowed: false, reason: 'minute_limit', limit: FREE_LIMITS.perMinute };
  }
  
  return { allowed: true };
}

// 🔥 2025年最新模型配置
const MODEL_CONFIG = {
  primary: 'gemini-2.5-flash',
  fallbacks: [
    'gemini-2.0-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-lite'
  ],
  maxRetries: 2
};

let currentModel = null;
let currentModelName = null;

function initializeAI() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error('❌ 錯誤：未設定 GOOGLE_API_KEY');
    return null;
  }
  
  try {
    return new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  } catch (error) {
    console.error('❌ 初始化 AI 失敗:', error.message);
    return null;
  }
}

const genAI = initializeAI();

async function getWorkingModel() {
  if (!genAI) {
    throw new Error('AI 服務未初始化');
  }
  
  // 使用快取
  if (currentModel && currentModelName) {
    try {
      console.log(`♻️  使用快取模型: ${currentModelName}`);
      return { model: currentModel, name: currentModelName };
    } catch (err) {
      console.log(`⚠️  快取模型失效: ${currentModelName}`);
      currentModel = null;
      currentModelName = null;
    }
  }
  
  const allModels = [MODEL_CONFIG.primary, ...MODEL_CONFIG.fallbacks];
  console.log(`\n🔍 測試 ${allModels.length} 個模型...`);
  
  for (const modelName of allModels) {
    try {
      console.log(`📡 測試: ${modelName}`);
      
      const model = genAI.getGenerativeModel({ model: modelName });
      
      for (let attempt = 1; attempt <= MODEL_CONFIG.maxRetries; attempt++) {
        try {
          console.log(`   🔄 嘗試 ${attempt}/${MODEL_CONFIG.maxRetries}...`);
          
          const startTime = Date.now();
          const result = await model.generateContent('test');
          const response = await result.response;
          await response.text();
          const responseTime = Date.now() - startTime;
          
          console.log(`   ✅ 成功！回應時間: ${responseTime}ms`);
          console.log(`✨ 模型 ${modelName} 已就緒\n`);
          
          currentModel = model;
          currentModelName = modelName;
          return { model, name: modelName };
          
        } catch (retryErr) {
          console.log(`   ❌ 嘗試 ${attempt} 失敗: ${retryErr.message.substring(0, 80)}`);
          
          if (attempt < MODEL_CONFIG.maxRetries) {
            const waitTime = attempt * 2000;
            console.log(`   ⏳ 等待 ${waitTime/1000} 秒後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      console.log(`   ⚠️  模型 ${modelName} 的所有嘗試都失敗\n`);
      USAGE_TRACKER.modelFailures[modelName] = (USAGE_TRACKER.modelFailures[modelName] || 0) + 1;
      
    } catch (err) {
      console.log(`   💥 模型 ${modelName} 初始化失敗\n`);
      USAGE_TRACKER.modelFailures[modelName] = (USAGE_TRACKER.modelFailures[modelName] || 0) + 1;
    }
  }
  
  console.log('\n❌ 所有模型都無法使用');
  throw new Error('所有模型都無法使用，請稍後再試');
}

const FALLBACK_RESPONSES = {
  error: "抱歉，目前服務繁忙。以下是一些基本建議：\n• 多喝水（每天8杯）\n• 攝取纖維（蔬果）\n• 規律運動\n• 保持良好作息",
  limit: "今日免費額度已用完。明天再見！\n\n💡 小提醒：多喝水對消化很有幫助喔！",
  apiKeyExpired: "⚠️ API Key 已過期\n\n請管理員前往 Google AI Studio 重新生成 API Key。"
};

function formatResponse(text) {
  if (!text) return FALLBACK_RESPONSES.error;
  
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '【$1】')
    .replace(/\*\*(.+?)\*\*\*/g, '【$1】')
    .replace(/^\* /gm, '• ')
    .replace(/^- /gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// === API 路由 ===

app.get('/', (req, res) => {
  resetCounters();
  res.json({ 
    service: 'PoopBot AI Assistant',
    version: '2.5-OPTIMIZED',
    status: genAI ? 'ready' : 'no_api_key',
    model: currentModelName || 'not_initialized',
    limits: FREE_LIMITS,
    usage: {
      today: USAGE_TRACKER.daily,
      remaining: FREE_LIMITS.perDay - USAGE_TRACKER.daily
    },
    message: 'Gemini 2.5 + 優化 Prompt + 增強回答品質',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/assistant', async (req, res) => {
  const startTime = Date.now();
  const { question } = req.body;
  
  if (!genAI) {
    return res.status(503).json({ 
      answer: FALLBACK_RESPONSES.apiKeyExpired,
      error: 'service_unavailable'
    });
  }
  
  if (!question || question.trim().length < 2) {
    return res.status(400).json({ 
      answer: '請提供有效的問題（至少2個字）',
      error: 'invalid_input'
    });
  }
  
  if (isAskingAboutApp(question)) {
    return res.json({
      answer: generateAppIntro(question),
      model: 'app-intro',
      status: 'success',
      usage: {
        today: USAGE_TRACKER.daily,
        remaining: FREE_LIMITS.perDay - USAGE_TRACKER.daily
      },
      responseTime: Date.now() - startTime
    });
  }
  
  const usageCheck = canUseAPI();
  if (!usageCheck.allowed) {
    const response = usageCheck.reason === 'daily_limit' 
      ? FALLBACK_RESPONSES.limit
      : '請稍後再試（每分鐘限制 ' + FREE_LIMITS.perMinute + ' 次）';
      
    return res.status(429).json({ 
      answer: response,
      error: usageCheck.reason
    });
  }
  
  USAGE_TRACKER.daily++;
  USAGE_TRACKER.minute++;
  USAGE_TRACKER.totalRequests++;
  
  try {
    console.log(`\n📞 處理新請求 #${USAGE_TRACKER.totalRequests}`);
    const { model, name: modelName } = await getWorkingModel();
    
    console.log(`📊 使用狀況: ${USAGE_TRACKER.daily}/${FREE_LIMITS.perDay}`);
    
    const userLang = detectLanguage(question);
    const enhancedPrompt = createEnhancedPrompt(question.trim(), userLang);
    
    console.log(`🤖 開始生成回答...`);
    
    // 🔥 增加超時到 45 秒
    const result = await Promise.race([
      model.generateContent(enhancedPrompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 45000)
      )
    ]);
    
    const response = await result.response;
    const answer = formatResponse(response.text());
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ 成功回應 (${responseTime}ms)\n`);
    
    const remaining = FREE_LIMITS.perDay - USAGE_TRACKER.daily;
    const usageInfo = remaining <= 5 
      ? `\n\n📊 今日剩餘：${remaining} 次`
      : '';
    
    res.json({ 
      answer: answer + usageInfo,
      model: modelName,
      status: 'success',
      usage: {
        today: USAGE_TRACKER.daily,
        remaining: remaining
      },
      responseTime: responseTime
    });
    
  } catch (error) {
    USAGE_TRACKER.failedRequests++;
    console.error(`❌ 錯誤: ${error.message}\n`);
    
    // API Key 過期特別處理
    if (error.message.includes('expired') || error.message.includes('API_KEY_INVALID')) {
      return res.status(503).json({
        answer: FALLBACK_RESPONSES.apiKeyExpired,
        error: 'api_key_expired'
      });
    }
    
    let errorResponse = FALLBACK_RESPONSES.error;
    let statusCode = 500;
    
    if (error.message.includes('timeout')) {
      errorResponse = '回應超時，AI 思考時間過長。請簡化問題或稍後再試。';
      statusCode = 504;
    } else if (error.message.includes('quota')) {
      errorResponse = 'API 使用量已達上限，請稍後再試。';
      statusCode = 429;
    }
    
    res.status(statusCode).json({ 
      answer: errorResponse,
      error: error.message.substring(0, 100),
      status: 'error'
    });
  }
});

app.get('/api/usage', (req, res) => {
  resetCounters();
  
  res.json({
    limits: FREE_LIMITS,
    current: {
      daily: USAGE_TRACKER.daily,
      minute: USAGE_TRACKER.minute,
      total: USAGE_TRACKER.totalRequests,
      failed: USAGE_TRACKER.failedRequests
    },
    remaining: {
      today: Math.max(0, FREE_LIMITS.perDay - USAGE_TRACKER.daily),
      thisMinute: Math.max(0, FREE_LIMITS.perMinute - USAGE_TRACKER.minute)
    },
    model: {
      current: currentModelName || 'none',
      failures: USAGE_TRACKER.modelFailures
    },
    history: usageLog.slice(-7)
  });
});

app.get('/api/health', (req, res) => {
  const health = {
    status: 'unknown',
    checks: {
      apiKey: !!process.env.GOOGLE_API_KEY,
      aiService: !!genAI,
      model: !!currentModel
    }
  };
  
  if (health.checks.apiKey && health.checks.aiService && health.checks.model) {
    health.status = 'healthy';
  } else if (health.checks.apiKey && health.checks.aiService) {
    health.status = 'degraded';
  } else {
    health.status = 'unhealthy';
  }
  
  res.status(health.status === 'unhealthy' ? 503 : 200).json({
    ...health,
    uptime: process.uptime(),
    currentModel: currentModelName,
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('未處理錯誤:', err);
  res.status(500).json({
    answer: FALLBACK_RESPONSES.error,
    error: 'internal_error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    available: ['/api/assistant', '/api/usage', '/api/health']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log(`🚀 PoopBot v2.5-OPTIMIZED`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`💚 完全免費 + Gemini 2.5`);
  console.log(`🧠 優化 Prompt 工程`);
  console.log(`📊 ${FREE_LIMITS.perDay}/天, ${FREE_LIMITS.perMinute}/分`);
  console.log('========================================\n');
});
