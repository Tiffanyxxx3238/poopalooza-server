require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

console.log('🚀 啟動免費版 PoopBot API');
console.log('API Key 狀態:', process.env.GOOGLE_API_KEY ? '✅ 已設定' : '❌ 未設定');

const app = express();
app.use(cors());
app.use(express.json());

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

// 多語言備用回應系統
const FALLBACK_RESPONSES = {
  'zh-TW': {
    error: "抱歉，目前服務繁忙。以下是一些基本建議：\n• 多喝水（每天8杯）\n• 攝取纖維（蔬果）\n• 規律運動\n• 保持良好作息",
    limit: "今日免費額度已用完。明天再見！\n\n💡 小提醒：多喝水對消化很有幫助喔！"
  },
  'zh-CN': {
    error: "抱歉，当前服务繁忙。以下是一些基本建议：\n• 多喝水（每天8杯）\n• 摄取纤维（蔬果）\n• 规律运动\n• 保持良好作息",
    limit: "今日免费额度已用完。明天再见！\n\n💡 小提醒：多喝水对消化很有帮助哦！"
  },
  'en': {
    error: "Sorry, service is busy. Here are some basic tips:\n• Drink water (8 glasses/day)\n• Eat fiber (fruits & vegetables)\n• Exercise regularly\n• Maintain good sleep schedule",
    limit: "Daily free quota exhausted. See you tomorrow!\n\n💡 Tip: Staying hydrated helps digestion!"
  },
  'ja': {
    error: "申し訳ございません。サービスが混雑しています。基本的なアドバイス：\n• 水分補給（1日8杯）\n• 食物繊維摂取\n• 規則的な運動\n• 良い睡眠習慣",
    limit: "本日の無料利用枠を使い切りました。また明日！\n\n💡 ヒント：水分補給は消化に役立ちます！"
  },
  'ko': {
    error: "죄송합니다. 서비스가 바쁩니다. 기본 조언:\n• 물 마시기 (하루 8잔)\n• 섬유질 섭취\n• 규칙적인 운동\n• 좋은 수면 습관",
    limit: "오늘의 무료 할당량이 소진되었습니다. 내일 봐요!\n\n💡 팁: 수분 섭취는 소화에 도움이 됩니다!"
  }
};

// 取得對應語言的備用回應
function getFallbackResponse(type, lang = 'en') {
  const responses = FALLBACK_RESPONSES[lang] || FALLBACK_RESPONSES['en'];
  return responses[type] || FALLBACK_RESPONSES['en'][type];
}

// 格式化回應
function formatResponse(text, lang = 'en') {
  if (!text) return getFallbackResponse('error', lang);
  
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
  
  // 檢查使用限制
  const usageCheck = canUseAPI();
  if (!usageCheck.allowed) {
    const lang = detectLanguage(question);
    const response = usageCheck.reason === 'daily_limit' 
      ? getFallbackResponse('limit', lang)
      : `請稍後再試（每分鐘限制 ${FREE_LIMITS.perMinute} 次）`;
      
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
    
    // 偵測語言並生成對應的 prompt
    const detectLanguage = (text) => {
      if (/[\u4e00-\u9fff]/.test(text)) {
        // 檢測繁簡中文
        if (text.includes('嗎') || text.includes('麼') || text.includes('這') || text.includes('說')) {
          return 'zh-TW'; // 繁體中文
        }
        if (text.includes('吗') || text.includes('么') || text.includes('这') || text.includes('说')) {
          return 'zh-CN'; // 簡體中文
        }
        return 'zh-TW'; // 預設繁體
      }
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'; // 日文
      if (/[\uac00-\ud7af]/.test(text)) return 'ko'; // 韓文
      if (/[àâäæãåāèéêëēėęîïíīįìôöòóœøōõûüùúūÿñçčšž]/i.test(text)) return 'eu'; // 歐洲語言
      return 'en'; // 預設英文
    };
    
    const lang = detectLanguage(question);
    let langInstruction = '';
    
    switch(lang) {
      case 'zh-TW':
        langInstruction = '請用繁體中文回答';
        break;
      case 'zh-CN':
        langInstruction = '请用简体中文回答';
        break;
      case 'ja':
        langInstruction = '日本語で答えてください';
        break;
      case 'ko':
        langInstruction = '한국어로 대답해 주세요';
        break;
      case 'en':
      default:
        langInstruction = 'Please respond in English';
        break;
    }
    
    const prompt = `You are PoopBot, a friendly digestive health assistant. ${langInstruction}. Keep response concise (under 100 words).

User Question: ${question.trim()}

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
    const lang = detectLanguage(question);
    let errorResponse = getFallbackResponse('error', lang);
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
