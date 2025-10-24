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
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
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

// ===== 🔥 新增：智能 Prompt 生成系統 =====
function createEnhancedPrompt(question, lang) {
  // 檢測問題類型
  const questionType = detectQuestionType(question);
  
  if (lang === 'zh') {
    // 繁體中文版本
    const baseInstruction = `你是 PoopBot，專業的消化健康助手和 PoopBot App 的 AI 顧問。

🎯 **你必須提供的回答品質**：
- 給出具體數字和方法（例如："每天喝 2000-2500ml 水，分 8-10 次"，而不是"多喝水"）
- 解釋為什麼有效（讓用戶理解原理）
- 提供多面向建議（飲食 + 運動 + 生活習慣）
- 說明預期效果時間（例如："3-5 天內改善"）`;

    // 根據問題類型給不同的範例
    let example = '';
    
    if (questionType === 'constipation') {
      example = `

📋 **好的回答範例**：
「便秘改善完整方案：

**立即可做**（今天開始）：
1. 早上空腹喝 300-500ml 溫水（約 40°C）—— 刺激腸道蠕動
2. 腹部順時針按摩 5-10 分鐘 —— 直接促進腸蠕動

**飲食調整**（3 天見效）：
- 高纖維：每天 25-30g（燕麥、地瓜、木耳）—— 增加糞便體積
- 益生菌：無糖優格 200ml/天 —— 改善腸道菌群
- 好油脂：1 湯匙橄欖油 —— 潤滑腸道

**生活習慣**：
- 固定時間如廁（建議早餐後）—— 訓練腸道反射
- 每天快走 30 分鐘 —— 促進蠕動

**就醫警訊**：超過 1 週未排便、血便、劇烈腹痛」`;
    } else if (questionType === 'diarrhea') {
      example = `

📋 **好的回答範例**：
「腹瀉處理步驟：

**緊急處理**（前 24 小時）：
1. 補充電解質：每小時 200ml 運動飲料 —— 防止脫水
2. BRAT 飲食：香蕉、白米、蘋果泥、吐司 —— 溫和好消化

**恢復期**（2-3 天）：
- 益生菌補充 —— 恢復菌群平衡
- 漸進加入：雞肉粥 → 蒸魚 → 青菜

**預防**：注意食物新鮮度、飯前洗手

**就醫警訊**：持續 3 天、高燒、血便、嚴重脫水」`;
    } else {
      example = `

📋 **回答要求**：
- 先分析可能原因（2-3 個）
- 提供具體解決方案（含數字、頻率）
- 解釋原理
- 說明見效時間
- 標明就醫時機`;
    }

    return `${baseInstruction}${example}

👤 **用戶問題**：${question}

🩺 **請提供深入、實用的專業建議**：`;

  } else {
    // 英文版本
    const baseInstruction = `You are PoopBot, a professional digestive health assistant and AI consultant for PoopBot App.

🎯 **Required Answer Quality**:
- Provide specific numbers and methods (e.g., "drink 2000-2500ml daily, split into 8-10 servings", not just "drink more water")
- Explain WHY it works (help users understand the mechanism)
- Offer multi-faceted advice (diet + exercise + lifestyle)
- State expected timeframe (e.g., "improvement within 3-5 days")`;

    let example = '';
    
    if (questionType === 'constipation') {
      example = `

📋 **Good Answer Example**:
"Constipation Relief Plan:

**Immediate Actions** (start today):
1. Drink 300-500ml warm water on empty stomach (40°C) — stimulates bowel movement
2. Clockwise abdominal massage 5-10 min — promotes peristalsis

**Dietary Changes** (effective in 3 days):
- High-fiber: 25-30g daily (oatmeal, sweet potato, mushrooms) — increases stool volume
- Probiotics: 200ml unsweetened yogurt/day — improves gut flora
- Healthy fats: 1 tbsp olive oil — lubricates intestines

**Lifestyle**:
- Regular toilet time (after breakfast) — trains bowel reflex
- 30-min brisk walk daily — promotes movement

**See Doctor If**: No bowel movement for 1 week, bloody stool, severe pain"`;
    } else if (questionType === 'diarrhea') {
      example = `

📋 **Good Answer Example**:
"Diarrhea Management:

**Emergency Care** (first 24 hours):
1. Electrolyte replacement: 200ml sports drink/hour — prevents dehydration
2. BRAT diet: Bananas, Rice, Applesauce, Toast — gentle on stomach

**Recovery** (2-3 days):
- Probiotics — restore gut balance
- Gradually add: chicken porridge → steamed fish → vegetables

**Prevention**: Check food freshness, wash hands before meals

**See Doctor If**: Lasts 3+ days, high fever, bloody stool, severe dehydration"`;
    } else {
      example = `

📋 **Answer Requirements**:
- Analyze possible causes (2-3)
- Provide specific solutions (with numbers, frequency)
- Explain mechanisms
- State timeframe for results
- Indicate when to seek medical care`;
    }

    return `${baseInstruction}${example}

👤 **User Question**: ${question}

🩺 **Provide in-depth, practical professional advice**:`;
  }
}

// 🔥 新增：檢測問題類型
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

// 模型管理
const MODEL_CONFIG = {
  primary: 'gemini-1.5-flash',
  fallbacks: [
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro'
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
  
  if (currentModel && currentModelName) {
    try {
      await currentModel.generateContent('test');
      return { model: currentModel, name: currentModelName };
    } catch (err) {
      console.log(`⚠️ 快取模型 ${currentModelName} 失效，尋找替代...`);
      currentModel = null;
      currentModelName = null;
    }
  }
  
  const allModels = [MODEL_CONFIG.primary, ...MODEL_CONFIG.fallbacks];
  
  for (const modelName of allModels) {
    try {
      console.log(`🔍 測試模型: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
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

// 🔥 改進：更溫和的格式化（保留更多原始內容）
function formatResponse(text) {
  if (!text) return FALLBACK_RESPONSES.error;
  
  return text
    // 保留粗體標記（改用不同符號）
    .replace(/\*\*\*(.+?)\*\*\*/g, '【$1】')
    .replace(/\*\*(.+?)\*\*/g, '【$1】')
    // 只處理單獨的星號（列表）
    .replace(/^\* /gm, '• ')
    .replace(/^- /gm, '• ')
    // 清理過多換行
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// === API 路由 ===

app.get('/', (req, res) => {
  resetCounters();
  res.json({ 
    service: 'PoopBot AI Assistant',
    version: '2.1-ENHANCED',
    status: genAI ? 'ready' : 'no_api_key',
    limits: FREE_LIMITS,
    usage: {
      today: USAGE_TRACKER.daily,
      remaining: FREE_LIMITS.perDay - USAGE_TRACKER.daily
    },
    message: '完全免費版本 - 改進 AI 回答品質',
    timestamp: new Date().toISOString()
  });
});

// 主要聊天端點
app.post('/api/assistant', async (req, res) => {
  const startTime = Date.now();
  const { question } = req.body;
  
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
  
  // 檢查是否詢問 App 功能
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
    
    // 🔥 使用新的智能 Prompt 系統
    const userLang = detectLanguage(question);
    const enhancedPrompt = createEnhancedPrompt(question.trim(), userLang);
    
    // 呼叫 AI（含超時保護）
    const result = await Promise.race([
      model.generateContent(enhancedPrompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 15000) // 增加到 15 秒，讓 AI 有時間思考
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
    
    if (error.message.includes('quota') || error.message.includes('429')) {
      USAGE_TRACKER.daily = Math.max(0, USAGE_TRACKER.daily - 1);
      USAGE_TRACKER.minute = Math.max(0, USAGE_TRACKER.minute - 1);
    }
    
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
    history: usageLog.slice(-7),
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
  console.log(`🚀 PoopBot 免費版 API 啟動 v2.1`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`💚 模式: 完全免費（無帳單風險）`);
  console.log(`🧠 AI 品質: 已優化 Prompt 工程`);
  console.log(`📊 限制: ${FREE_LIMITS.perDay} 次/天, ${FREE_LIMITS.perMinute} 次/分鐘`);
  console.log(`🔒 安全機制: 已啟用`);
  console.log('========================================');
});