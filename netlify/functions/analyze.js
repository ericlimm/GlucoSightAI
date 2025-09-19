// 메인 클래스만 필요합니다.
const { GoogleGenAI } = require("@google/genai");

// 환경 변수에서 API 키를 가져옵니다.
const API_KEY = process.env.GEMINI_API_KEY;

// --- START: 올바른 인증 ---
// API 키를 사용하여 AI 클라이언트를 생성합니다. 이것이 결정적인 변경 사항입니다.
const genAI = new GoogleGenAI(API_KEY);
// --- END: 올바른 인증 ---

// 스키마 정의는 이전과 동일합니다.
const analysisSchema = {
  type: "OBJECT",
  properties: {
    nutrition: {
      type: "OBJECT",
      description: "음식의 영양 정보.",
      properties: {
        foodName: { type: "STRING", description: "음식의 이름 (예: '닭가슴살 샐러드')." },
        calories: { type: "NUMBER", description: "총 칼로리 (kcal)." },
        carbohydrates: {
          type: "OBJECT",
          properties: {
            total: { type: "NUMBER", description: "총 탄수화물 (g)." },
            sugars: { type: "NUMBER", description: "당류 (g)." },
            fiber: { type: "NUMBER", description: "식이섬유 (g)." },
          },
          required: ['total', 'sugars', 'fiber']
        },
        protein: { type: "NUMBER", description: "단백질 (g)." },
        fat: { type: "NUMBER", description: "총 지방 (g)." },
        glycemicIndex: { type: "NUMBER", description: "예상 혈당지수 (GI) (1-100)." },
      },
      required: ['foodName', 'calories', 'carbohydrates', 'protein', 'fat', 'glycemicIndex']
    },
    impact: {
      type: "OBJECT",
      description: "예상 혈당 영향 분석.",
      properties: {
        level: {
          type: "STRING",
          enum: ['STABLE', 'MODERATE', 'HIGH'],
          description: "혈당 영향 수준: 'STABLE' (안정), 'MODERATE' (보통), 'HIGH' (높음)."
        },
        explanation: { type: "STRING", description: "당뇨 환자를 위한 쉽고 간단한 한국어 설명." }
      },
      required: ['level', 'explanation']
    }
  },
  required: ['nutrition', 'impact']
};


exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  
  try {
    // 이 요청에 사용할 특정 모델을 가져옵니다.
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash"
    });

    const { imageBase64, mimeType } = JSON.parse(event.body);
    if (!imageBase64 || !mime.Type) {
      return { statusCode: 400, body: JSON.stringify({ error: "이미지 데이터가 없습니다." }) };
    }

    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    
    const textPart = { 
      text: `당뇨병 환자를 위한 영양사로서 이 이미지의 음식을 분석해주세요. 
      1. 음식 종류를 식별하고 양을 추정하여, 전체 식사에 대한 예상 영양 정보를 계산해주세요.
      2. 그 영양 정보를 바탕으로, 일반적인 당뇨병 환자의 혈당에 미칠 영향을 'STABLE', 'MODERATE', 'HIGH' 중 하나로 분류하고, 그 이유를 쉽고 간단한 한국어로 설명해주세요.
      이 두 가지 결과를 모두 포함하여 JSON 형식으로 응답해야 합니다.` 
    };
    
    // 올바른 메서드를 사용하여 콘텐츠를 생성합니다.
    const result = await model.generateContent({
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
    // 이제 여기서 발생하는 모든 오류는 인증 오류가 아닌, 진짜 AI 오류일 것입니다.
    console.error('AI 분석 중 오류 발생:', error);
    const errorMessage = error.message || "서버에서 AI 분석 중 알 수 없는 오류가 발생했습니다.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
