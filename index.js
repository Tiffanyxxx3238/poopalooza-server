require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🚀 啟動免費版 PoopBot API');
console.log('API Key 狀態:', process.env.GOOGLE_API_KEY ? '✅ 已設定' : '❌ 未設定');

// 🔥 新增：顯示 API Key 資訊（安全檢查）
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

// 生成 App 介紹
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

// ===== 智能 Prompt 生成系統 =====
function createEnhancedPrompt(question, lang) {
  const questionType = detectQuestionType(question);
  
  if (lang === 'zh') {
    const baseInstruction = `你是 PoopBot，專業的消化健康助手和 PoopBot App 的 AI 顧問。

🎯 **你必須提供的回答品質**：
- 給出具體數字和方法（例如："每天喝 2000-2500ml 水，分 8-10 次"，而不是"多喝水"）
- 解釋為什麼有效（讓用戶理解原理）
- 提供多面向建議（飲食 + 運動 + 生活習慣）
- 說明預期效果時間（例如："3-5 天內改善"）`;

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

// 檢測問題類型
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

// ===== 免費額度管理系統 =====
const USAGE_TRACKER = {
  daily: 0,
  minute: 0,
  lastDailyReset: new Date().toDateString(),
  lastMinuteReset: Date.now(),
  totalRequests: 0,
  failedRequests: 0,
  modelFailures: {},
  networkErrors: 0  // 🔥 新增：網路錯誤計數
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
  primary: 'gemini-2.5-flash',      // 最新最快模型
  fallbacks: [
    'gemini-2.0-flash',              // 備用方案 1
    'gemini-2.5-pro',                // 備用方案 2（最強但較慢）
    'gemini-2.0-flash-lite'          // 備用方案 3（輕量版）
  ],
  maxRetries: 2  // 減少重試次數，加快速度
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

// 🔥 方案 B：加強版模型獲取（含詳細錯誤和重試）
async function getWorkingModel() {
  if (!genAI) {
    throw new Error('AI 服務未初始化');
  }
  
  // 嘗試使用快取模型
  if (currentModel && currentModelName) {
    try {
      console.log(`♻️  嘗試使用快取模型: ${currentModelName}`);
      const testResult = await currentModel.generateContent('test');
      await testResult.response.text();
      console.log(`✅ 快取模型可用: ${currentModelName}`);
      return { model: currentModel, name: currentModelName };
    } catch (err) {
      console.log(`⚠️  快取模型 ${currentModelName} 失效`);
      console.log(`   失效原因: ${err.message}`);
      currentModel = null;
      currentModelName = null;
    }
  }
  
  // 嘗試所有可用模型
  const allModels = [MODEL_CONFIG.primary, ...MODEL_CONFIG.fallbacks];
  console.log(`\n🔍 開始測試 ${allModels.length} 個模型...`);
  
  for (const modelName of allModels) {
    console.log(`\n📡 測試模型: ${modelName}`);
    
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName
      });
      
      // 🔥 重試機制（每個模型嘗試 3 次）
      let lastError = null;
      
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
          lastError = retryErr;
          
          // 🔥 詳細錯誤分析
          console.log(`   ❌ 嘗試 ${attempt} 失敗`);
          console.log(`   錯誤訊息: ${retryErr.message}`);
          console.log(`   錯誤類型: ${retryErr.constructor.name}`);
          
          // 檢查是否為網路錯誤
          if (retryErr.message.includes('fetch') || 
              retryErr.message.includes('network') ||
              retryErr.message.includes('ECONNREFUSED') ||
              retryErr.message.includes('ETIMEDOUT')) {
            console.log(`   🌐 這是網路連接問題`);
            USAGE_TRACKER.networkErrors++;
          }
          
          // 如果還有重試機會，等待後重試
          if (attempt < MODEL_CONFIG.maxRetries) {
            const waitTime = attempt * 2000; // 2秒、4秒、6秒
            console.log(`   ⏳ 等待 ${waitTime/1000} 秒後重試...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      // 所有重試都失敗，記錄並繼續下一個模型
      console.log(`   ⚠️  模型 ${modelName} 的所有嘗試都失敗`);
      if (lastError) {
        console.log(`   最後錯誤: ${lastError.message}`);
      }
      
      USAGE_TRACKER.modelFailures[modelName] = (USAGE_TRACKER.modelFailures[modelName] || 0) + 1;
      
    } catch (err) {
      console.log(`   💥 模型 ${modelName} 初始化失敗: ${err.message}`);
      USAGE_TRACKER.modelFailures[modelName] = (USAGE_TRACKER.modelFailures[modelName] || 0) + 1;
    }
  }
  
  // 所有模型都失敗
  console.log('\n❌ 所有模型都無法使用\n');
  console.log('📊 錯誤統計:');
  console.log(`   網路錯誤次數: ${USAGE_TRACKER.networkErrors}`);
  console.log(`   模型失敗記錄:`, USAGE_TRACKER.modelFailures);
  
  // 根據錯誤類型給出建議
  if (USAGE_TRACKER.networkErrors > 0) {
    throw new Error('網路連接問題：無法連接到 Google AI API。請檢查：\n1. Render 是否允許外部 API 連接\n2. API Key 是否正確\n3. Google AI Studio 服務狀態');
  }
  
  throw new Error('所有模型都無法使用，請稍後再試');
}

// 備用回應
const FALLBACK_RESPONSES = {
  greeting: [
    "你好！我是 PoopBot，你的消化健康助手。有什麼可以幫助你的嗎？",
    "嗨！需要消化健康的建議嗎？我在這裡幫助你！"
  ],
  error: "抱歉，目前服務繁忙。以下是一些基本建議：\n• 多喝水（每天8杯）\n• 攝取纖維（蔬果）\n• 規律運動\n• 保持良好作息",
  limit: "今日免費額度已用完。明天再見！\n\n💡 小提醒：多喝水對消化很有幫助喔！",
  network: "網路連接問題，無法連接到 AI 服務。請稍後再試或聯繫管理員。"
};

// 格式化回應
function formatResponse(text) {
  if (!text) return FALLBACK_RESPONSES.error;
  
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '【$1】')
    .replace(/\*\*(.+?)\*\*/g, '【$1】')
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
    version: '2.1-ENHANCED-DEBUG',
    status: genAI ? 'ready' : 'no_api_key',
    limits: FREE_LIMITS,
    usage: {
      today: USAGE_TRACKER.daily,
      remaining: FREE_LIMITS.perDay - USAGE_TRACKER.daily
    },
    diagnostics: {
      networkErrors: USAGE_TRACKER.networkErrors,
      modelFailures: USAGE_TRACKER.modelFailures,
      currentModel: currentModelName || 'none'
    },
    message: '完全免費版本 - 改進 AI 回答品質 + 診斷模式',
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
    console.log(`\n📞 處理新請求 #${USAGE_TRACKER.totalRequests}`);
    const { model, name: modelName } = await getWorkingModel();
    
    console.log(`📊 使用狀況: ${USAGE_TRACKER.daily}/${FREE_LIMITS.perDay}`);
    
    // 使用智能 Prompt
    const userLang = detectLanguage(question);
    const enhancedPrompt = createEnhancedPrompt(question.trim(), userLang);
    
    console.log(`🤖 開始生成回答...`);
    
    // 呼叫 AI
    const result = await Promise.race([
      model.generateContent(enhancedPrompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 20000)
      )
    ]);
    
    const response = await result.response;
    const answer = formatResponse(response.text());
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ 成功回應 (總耗時: ${responseTime}ms)\n`);
    
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
    console.error('\n❌ 處理請求失敗');
    console.error(`錯誤訊息: ${error.message}`);
    console.error(`錯誤類型: ${error.constructor.name}\n`);
    
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
    } else if (error.message.includes('網路')) {
      errorResponse = FALLBACK_RESPONSES.network;
      statusCode = 503;
    }
    
    res.status(statusCode).json({ 
      answer: errorResponse,
      error: error.message.substring(0, 200),
      status: 'error',
      usage: {
        today: USAGE_TRACKER.daily,
        remaining: Math.max(0, FREE_LIMITS.perDay - USAGE_TRACKER.daily)
      },
      diagnostics: {
        networkErrors: USAGE_TRACKER.networkErrors,
        failedRequests: USAGE_TRACKER.failedRequests
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
      failed: USAGE_TRACKER.failedRequests,
      networkErrors: USAGE_TRACKER.networkErrors
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
    },
    diagnostics: {
      networkErrors: USAGE_TRACKER.networkErrors,
      modelFailures: USAGE_TRACKER.modelFailures,
      totalRequests: USAGE_TRACKER.totalRequests,
      failedRequests: USAGE_TRACKER.failedRequests
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
  console.log('\n========================================');
  console.log(`🚀 PoopBot 免費版 API 啟動 v2.1-DEBUG`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`💚 模式: 完全免費（無帳單風險）`);
  console.log(`🧠 AI 品質: 已優化 Prompt 工程`);
  console.log(`🔍 診斷模式: 已啟用詳細錯誤日誌`);
  console.log(`📊 限制: ${FREE_LIMITS.perDay} 次/天, ${FREE_LIMITS.perMinute} 次/分鐘`);
  console.log(`🔒 安全機制: 已啟用`);
  console.log('========================================\n');
});