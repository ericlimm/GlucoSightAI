const { GoogleGenAI } = require("@google/genai");

// 스키마는 변경 없습니다.
const analysisSchema = { /* ... 이전과 동일한 스키마 내용 ... */ }; // 스키마 내용은 생략합니다.

exports.handler = async function (event, context) {
  const API_KEY = process.env.GEMINI_API_KEY;

  // --- START: 최종 진단 코드 ---
  console.log("--- FINAL DIAGNOSIS: CHECKING API KEY ---");
  if (API_KEY && typeof API_KEY === 'string' && API_KEY.length > 10) {
    console.log("SUCCESS: GEMINI_API_KEY environment variable was found.");
    console.log("API Key Length:", API_KEY.length);
    console.log("API Key Snippet:", `${API_KEY.substring(0, 4)}...${API_KEY.slice(-4)}`);
  } else {
    console.error("CRITICAL FAILURE: GEMINI_API_KEY environment variable is MISSING, empty, or too short.");
    console.log("Value of process.env.GEMINI_API_KEY:", API_KEY);
    const errorMessage = "CRITICAL FAILURE: The API key is not available in the function's runtime environment.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
  // --- END: 최종 진단 코드 ---
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  
  try {
    const genAI = new GoogleGenAI(API_KEY);
    const model = genAI.models.generateContent({ /* ... */ }); // 이 부분은 이제 실행될 것입니다.
    // ... 나머지 코드는 이전과 동일 ...

    const { imageBase64, mimeType } = JSON.parse(event.body);
    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    const textPart = { text: `...` };
    const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [textPart, imagePart] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
        },
    });
    const response = result.response;
    const responseText = response.text();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: responseText, 
    };
  } catch (error) {
    console.error('Error during AI analysis:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
