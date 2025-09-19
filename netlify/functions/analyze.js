const { GoogleGenerativeAI } = require("@google/genai");

const API_KEY = process.env.GEMINI_API_KEY;

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
  // --- START: 진단 코드 ---
  // AI 라이브러리가 올바르게 로드되었는지 확인합니다.
  if (typeof GoogleGenerativeAI !== 'function') {
    const errorMessage = "심각한 서버 오류: GoogleGenerativeAI가 함수/클래스로 로드되지 않았습니다. 라이브러리 설치 또는 로딩 과정에 문제가 있습니다.";
    console.error(errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI 라이브러리를 초기화하는 데 실패했습니다." }),
    };
  }
  // --- END: 진단 코드 ---

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  if (!API_KEY) {
    console.error("GEMINI_API_KEY environment variable not set.");
    return { statusCode: 500, body: JSON.stringify({ error: "서버 설정 오류: API 키가 구성되지 않았습니다." }) };
  }
  
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

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

    const result = await model.generateContent([textPart, imagePart]);
    const response = result.response;
    const responseText = response.text();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: responseText, 
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    // 생성자 오류가 여기서 다시 발생할 경우를 대비한 상세 로그 추가
    if (error instanceof TypeError && error.message.includes("is not a constructor")) {
       console.error("추가 정보: 생성자(Constructor) 오류가 try-catch 블록 내부에서 발생했습니다.");
    }
    const errorMessage = error.message || "서버에서 AI 분석 중 알 수 없는 오류가 발생했습니다.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};

