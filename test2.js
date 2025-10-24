const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyAKLoCFSEy5gBfoBKtR5lf1zEcfcVot1E4';

const genAI = new GoogleGenerativeAI(API_KEY);

async function testNewModels() {
  const modelsToTest = [
    'gemini-2.5-flash',      // 🔥 2025年6月的最新模型
    'gemini-2.0-flash',      // 🔥 2025年1月的模型
    'gemini-2.5-pro',        // 🔥 最強模型
  ];
  
  console.log('=== 測試 2025 年的新模型 ===\n');
  
  for (const modelName of modelsToTest) {
    try {
      console.log(`測試: ${modelName}`);
      
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent('Say hi in 5 words');
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ 成功！`);
      console.log(`回應: ${text}\n`);
      console.log(`🎉🎉🎉 可用模型: ${modelName} 🎉🎉🎉\n`);
      return;
      
    } catch (error) {
      console.log(`❌ ${error.message.substring(0, 100)}\n`);
    }
  }
}

testNewModels();