const { GoogleGenAI } = require("@google/genai");

const API_KEY = process.env.GEMINI_API_KEY;

// 스키마 정의는 변경 없습니다.
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
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "서버 설정 오류: API 키가 구성되지 않았습니다." }) };
  }
  
  try {
    const genAI = new GoogleGenAI(API_KEY);

    const { imageBase64, mimeType } = JSON.parse(event.body);
    if (!imageBase64 || !mimeType) {
      return { statusCode: 400, body: JSON.stringify({ error: "이미지 데이터가 없습니다." }) };
    }

    const imagePart = { inlineData: { data: imageBase64, mimeType: mimeType } };
    
    const textPart = { 
      text: `당뇨병 환자를 위한 영양사로서 이 이미지의 음식을 분석해주세요. 
      1. 음식 종류를 식별하고 양을 추정하여, 전체 식사에 대한 예상 영양 정보를 계산해주세요.
      2. 그 영양 정보를 바탕으로, 일반적인 당뇨병 환자의 혈당에 미칠 영향을 'STABLE', 'MODERATE', 'HIGH' 중 하나로 분류하고, 그 이유를 쉽고 간단한 한국어로 설명해주세요.
      이 두 가지 결과를 모두 포함하여 JSON 형식으로 응답해야 합니다.` 
    };

    // --- START: API 호출 방식 최종 수정 ---
    const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [textPart, imagePart] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
        },
    });
    // --- END: API 호출 방식 최종 수정 ---

    c
