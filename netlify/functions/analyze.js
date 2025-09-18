const { GoogleGenAI, Type } = require("@google/genai");

const API_KEY = process.env.GEMINI_API_KEY;

// --- START: 스키마를 하나로 통합 ---
const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    nutrition: {
      type: Type.OBJECT,
      description: "음식의 영양 정보.",
      properties: {
        foodName: { type: Type.STRING, description: "음식의 이름 (예: '닭가슴살 샐러드')." },
        calories: { type: Type.NUMBER, description: "총 칼로리 (kcal)." },
        carbohydrates: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER, description: "총 탄수화물 (g)." },
            sugars: { type: Type.NUMBER, description: "당류 (g)." },
            fiber: { type: Type.NUMBER, description: "식이섬유 (g)." },
          },
          required: ['total', 'sugars', 'fiber']
        },
        protein: { type: Type.NUMBER, description: "단백질 (g)." },
        fat: { type: Type.NUMBER, description: "총 지방 (g)." },
        glycemicIndex: { type: Type.NUMBER, description: "예상 혈당지수 (GI) (1-100)." },
      },
      required: ['foodName', 'calories', 'carbohydrates', 'protein', 'fat', 'glycemicIndex']
    },
    impact: {
      type: Type.OBJECT,
      description: "예상 혈당 영향 분석.",
      properties: {
        level: {
          type: Type.STRING,
          enum: ['STABLE', 'MODERATE', 'HIGH'],
          description: "혈당 영향 수준: 'STABLE' (안정), 'MODERATE' (보통), 'HIGH' (높음)."
        },
        explanation: { type: Type.STRING, description: "당뇨 환자를 위한 쉽고 간단한 한국어 설명." }
      },
      required: ['level', 'explanation']
    }
  },
  required: ['nutrition', 'impact']
};
// --- END: 스키마 통합 ---


exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  if (!API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set.");
    return { statusCode: 500, body: JSON.stringify({ error: "서버 설정 오류: API 키가 구성되지 않았습니다." }) };
  }
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const { imageBase64, mimeType } = JSON.parse(event.body);
    if (!imageBase64 || !mimeType) {
      return { statusCode: 400, body: JSON.stringify({ error: "이미지 데이터가 없습니다." }) };
    }

    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    
    // --- START: 프롬프트를 하나로 통합 ---
    const textPart = { 
      text: `당뇨병 환자를 위한 영양사로서 이 이미지의 음식을 분석해주세요. 
      1. 음식 종류를 식별하고 양을 추정하여, 전체 식사에 대한 예상 영양 정보를 계산해주세요.
      2. 그 영양 정보를 바탕으로, 일반적인 당뇨병 환자의 혈당에 미칠 영향을 'STABLE', 'MODERATE', 'HIGH' 중 하나로 분류하고, 그 이유를 쉽고 간단한 한국어로 설명해주세요.
      이 두 가지 결과를 모두 포함하여 정확한 JSON 형식으로 응답해야 합니다.` 
    };
    // --- END: 프롬프트 통합 ---

    // --- START: API 호출을 한 번으로 변경 ---
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: [{ parts: [imagePart, textPart] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const responsePayload = JSON.parse(result.response.text());
    // --- END: API 호출 변경 ---
    
    // 응답 형식 검증 (선택적이지만 안정성을 위해 추가)
    if (!responsePayload.nutrition || !responsePayload.impact) {
      throw new Error("API로부터 완전한 분석 데이터를 받지 못했습니다.");
    }
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responsePayload),
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    // Google API에서 발생한 오류 메시지를 좀 더 구체적으로 전달
    const errorMessage = error.response?.text() || error.message || "서버에서 AI 분석 중 알 수 없는 오류가 발생했습니다.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
