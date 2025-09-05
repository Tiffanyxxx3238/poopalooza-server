require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🚀 啟動免費版 PoopBot API');
console.log('API Key 狀態:', process.env.GOOGLE_API_KEY ? '✅ 已設定' : '❌ 未設定');

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

// 檢測語言
function detectLanguage(text) {
  // 檢查是否包含中文字符
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return 'zh';
  }
  // 預設英文
  return 'en';
}

// 檢測是否在詢問 App 功能
function isAskingAboutApp(question) {
  const lowerQuestion = question.toLowerCase();
  return APP_FEATURES.keywords.some(keyword => 
    lowerQuestion.includes(keyword.toLowerCase())
  );
}

// 生成 App 介紹（根據語言）
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
// ===== 免費額度嚴格管理系統 =====
const USAGE_TRACKER = {
  daily: 0,
  minute: 0,
  lastDailyReset: new Date().toDateString(),
  lastMinuteReset: Date.now(),
  totalRequests: 0,
  failedRequests: 0,
  modelFailures: {}
};

// 保守的免費限制（確保不會超過）
const FREE_LIMITS = {
  perMinute: 5,    // 極保守（實際限制 15）
  perDay: 50,      // 極保守（實際限制 1500）
  perHour: 20      // 額外的小時限制
};

// 使用紀錄（用於分析）
const usageLog = [];

// 重置所有計數器
function resetCounters() {
  const now = Date.now();
  const today = new Date().toDateString();
  const currentHour = new Date().getHours();
  
  // 每日重置
  if (today !== USAGE_TRACKER.lastDailyReset) {
    console.log(`📅 每日計數器重置: ${USAGE_TRACKER.daily} -> 0`);
    USAGE_TRACKER.daily = 0;
    USAGE_TRACKER.lastDailyReset = today;
    // 保存昨日使用紀錄
    usageLog.push({
      date: USAGE_TRACKER.lastDailyReset,
      count: USAGE_TRACKER.daily
    });
  }
  
  // 每分鐘重置
  if (now - USAGE_TRACKER.lastMinuteReset > 60000) {
    USAGE_TRACKER.minute = 0;
    USAGE_TRACKER.lastMinuteReset = now;
  }
}

// 檢查是否可以使用
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

// 模型管理（含備用方案）
const MODEL_CONFIG = {
  primary: 'gemini-1.5-flash',
  fallbacks: [
    'gemini-1.5-flash-8b',  // 更輕量的版本
    'gemini-1.0-pro'        // 舊版但穩定
  ],
  maxRetries: 2
};

let currentModel = null;
let currentModelName = null;

// 初始化 AI（含錯誤處理）
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

// 取得可用模型（含備用機制）
async function getWorkingModel() {
  if (!genAI) {
    throw new Error('AI 服務未初始化');
  }
  
  // 如果有快取且可用，直接返回
  if (currentModel && currentModelName) {
    try {
      // 快速測試
      await currentModel.generateContent('test');
      return { model: currentModel, name: currentModelName };
    } catch (err) {
      console.log(`⚠️ 快取模型 ${currentModelName} 失效，尋找替代...`);
      currentModel = null;
      currentModelName = null;
    }
  }
  
  // 嘗試所有模型
  const allModels = [MODEL_CONFIG.primary, ...MODEL_CONFIG.fallbacks];
  
  for (const modelName of allModels) {
    try {
      console.log(`🔍 測試模型: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // 測試模型
      const result = await model.generateContent('test');
      await result.response.text();
      
      console.log(`✅ 模型可用: ${modelName}`);
      currentModel = model;
      currentModelName = modelName;
      return { model, name: modelName };
      
    } catch (err) {
      console.log(`❌ 模型 ${modelName} 不可用: ${err.message.substring(0, 50)}...`);
      USAGE_TRACKER.modelFailures[modelName] = (USAGE_TRACKER.modelFailures[modelName] || 0) + 1;
    }
  }
  
  throw new Error('所有模型都無法使用，請稍後再試');
}

// 簡單的備用回應系統
const FALLBACK_RESPONSES = {
  greeting: [
    "你好！我是 PoopBot，你的消化健康助手。有什麼可以幫助你的嗎？",
    "嗨！需要消化健康的建議嗎？我在這裡幫助你！"
  ],
  error: "抱歉，目前服務繁忙。以下是一些基本建議：\n• 多喝水（每天8杯）\n• 攝取纖維（蔬果）\n• 規律運動\n• 保持良好作息",
  limit: "今日免費額度已用完。明天再見！\n\n💡 小提醒：多喝水對消化很有幫助喔！"
};

// 格式化回應
function formatResponse(text) {
  if (!text) return FALLBACK_RESPONSES.error;
  
  return text
    .replace(/\*+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// === API 路由 ===

// 首頁
app.get('/', (req, res) => {
  resetCounters();
  res.json({ 
    service: 'PoopBot AI Assistant',
    version: '2.0-FREE',
    status: genAI ? 'ready' : 'no_api_key',
    limits: FREE_LIMITS,
    usage: {
      today: USAGE_TRACKER.daily,
      remaining: FREE_LIMITS.perDay - USAGE_TRACKER.daily
    },
    message: '完全免費版本 - 不會產生任何費用',
    timestamp: new Date().toISOString()
  });
});

// 主要聊天端點
app.post('/api/assistant', async (req, res) => {
  const startTime = Date.now();
  const { question } = req.body;
  
  // 基本驗證
  if (!genAI) {
    return res.status(503).json({ 
      answer: '服務未就緒。請確認已設定 API Key。',
      error: 'service_unavailable'
    });
  }
  
  if (!question || question.trim().length < 2) {
    return res.status(400).json({ 
      answer: '請提供有效的問題（至少2個字）',
      error: 'invalid_input'
    });
  }
  // === 新增：檢查是否詢問 App 功能 ===
  if (isAskingAboutApp(question)) {
    const appIntro = generateAppIntro(question);
    
    console.log(`📱 回應 App 介紹（不消耗 API 額度）`);
    
    return res.json({
      answer: appIntro,
      model: 'app-intro',
      status: 'success',
      usage: {
        today: USAGE_TRACKER.daily,
        remaining: FREE_LIMITS.perDay - USAGE_TRACKER.daily
      },
      responseTime: Date.now() - startTime
    });
  }
  // 檢查使用限制
  const usageCheck = canUseAPI();
  if (!usageCheck.allowed) {
    const response = usageCheck.reason === 'daily_limit' 
      ? FALLBACK_RESPONSES.limit
      : '請稍後再試（每分鐘限制 ' + FREE_LIMITS.perMinute + ' 次）';
      
    return res.status(429).json({ 
      answer: response,
      error: usageCheck.reason,
      limit: usageCheck.limit,
      usage: {
        today: USAGE_TRACKER.daily,
        remaining: Math.max(0, FREE_LIMITS.perDay - USAGE_TRACKER.daily)
      }
    });
  }
  
  // 增加計數
  USAGE_TRACKER.daily++;
  USAGE_TRACKER.minute++;
  USAGE_TRACKER.totalRequests++;
  
  try {
    // 取得可用模型
    const { model, name: modelName } = await getWorkingModel();
    
    console.log(`📊 使用狀況: ${USAGE_TRACKER.daily}/${FREE_LIMITS.perDay} | 模型: ${modelName}`);
    
// 偵測用戶語言
    const userLang = detectLanguage(question);
    
    // 生成簡單的 prompt（避免 token 浪費）
    const prompt = userLang === 'zh' 
      ? `你是 PoopBot，一個友善的消化健康助手，也是 PoopBot App 的 AI 助理。

如果用戶詢問 app 功能，可以介紹：便便記錄、健康分析、智慧提醒、廁所地圖等功能。

請用繁體中文簡短回答（不超過100字）。

用戶問題：${question.trim()}

回答：`
      : `You are PoopBot, a friendly digestive health assistant and the AI assistant for PoopBot App.

If users ask about app features, you can introduce: poop tracking, health analysis, smart reminders, toilet map, etc.

Please answer briefly in English (under 100 words).

User question: ${question.trim()}

Answer:`;
    
    // 呼叫 AI（含超時保護）
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 10000)
      )
    ]);
    
    const response = await result.response;
    const answer = formatResponse(response.text());
    
    // 記錄成功
    const responseTime = Date.now() - startTime;
    console.log(`✅ 成功回應 (${responseTime}ms)`);
    
    // 加入使用情況
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
    console.error('❌ 處理錯誤:', error.message);
    
    // 如果是配額問題，不扣除使用次數
    if (error.message.includes('quota') || error.message.includes('429')) {
      USAGE_TRACKER.daily = Math.max(0, USAGE_TRACKER.daily - 1);
      USAGE_TRACKER.minute = Math.max(0, USAGE_TRACKER.minute - 1);
    }
    
    // 根據錯誤類型返回不同訊息
    let errorResponse = FALLBACK_RESPONSES.error;
    let statusCode = 500;
    
    if (error.message.includes('timeout')) {
      errorResponse = '回應超時，請重試。';
      statusCode = 504;
    } else if (error.message.includes('quota')) {
      errorResponse = 'Google API 配額暫時用完，請幾分鐘後再試。';
      statusCode = 429;
    }
    
    res.status(statusCode).json({ 
      answer: errorResponse,
      error: error.message.substring(0, 100),
      status: 'error',
      usage: {
        today: USAGE_TRACKER.daily,
        remaining: Math.max(0, FREE_LIMITS.perDay - USAGE_TRACKER.daily)
      }
    });
  }
});

// 使用情況端點
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
    history: usageLog.slice(-7), // 最近7天
    resetTime: {
      daily: '每日 00:00',
      minute: new Date(USAGE_TRACKER.lastMinuteReset + 60000).toISOString()
    }
  });
});

// 健康檢查
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'unknown',
    checks: {
      apiKey: !!process.env.GOOGLE_API_KEY,
      aiService: !!genAI,
      model: !!currentModel
    }
  };
  
  // 判斷整體狀態
  if (health.checks.apiKey && health.checks.aiService) {
    health.status = 'healthy';
  } else if (health.checks.apiKey) {
    health.status = 'degraded';
  } else {
    health.status = 'unhealthy';
  }
  
  res.status(health.status === 'unhealthy' ? 503 : 200).json({
    ...health,
    uptime: process.uptime(),
    usage: USAGE_TRACKER,
    timestamp: new Date().toISOString()
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('未處理錯誤:', err);
  res.status(500).json({
    answer: FALLBACK_RESPONSES.error,
    error: 'internal_error'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: '端點不存在',
    available: ['/api/assistant', '/api/usage', '/api/health']
  });
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log(`🚀 PoopBot 免費版 API 啟動`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`💚 模式: 完全免費（無帳單風險）`);
  console.log(`📊 限制: ${FREE_LIMITS.perDay} 次/天, ${FREE_LIMITS.perMinute} 次/分鐘`);
  console.log(`🔒 安全機制: 已啟用`);
  console.log('========================================');
});
