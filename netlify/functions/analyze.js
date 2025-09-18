const { GoogleGenAI, Type } = require("@google/genai");

const API_KEY = process.env.GEMINI_API_KEY;

const nutritionSchema = { type: Type.OBJECT, properties: { foodName: { type: Type.STRING, description: "음식의 이름 (예: '닭가슴살 샐러드')." }, calories: { type: Type.NUMBER, description: "총 칼로리 (kcal)." }, carbohydrates: { type: Type.OBJECT, properties: { total: { type: Type.NUMBER, description: "총 탄수화물 (g)." }, sugars: { type: Type.NUMBER, description: "당류 (g)." }, fiber: { type: Type.NUMBER, description: "식이섬유 (g)." }, }, required: ['total', 'sugars', 'fiber'] }, protein: { type: Type.NUMBER, description: "단백질 (g)." }, fat: { type: Type.NUMBER, description: "총 지방 (g)." }, glycemicIndex: { type: Type.NUMBER, description: "예상 혈당지수 (GI) (1-100)." }, }, required: ['foodName', 'calories', 'carbohydrates', 'protein', 'fat', 'glycemicIndex'] };
const impactSchema = { type: Type.OBJECT, properties: { level: { type: Type.STRING, enum: ['STABLE', 'MODERATE', 'HIGH'], description: "혈당 영향 수준: 'STABLE' (안정), 'MODERATE' (보통), 'HIGH' (높음)." }, explanation: { type: Type.STRING, description: "당뇨 환자를 위한 쉽고 간단한 한국어 설명." } }, required: ['level', 'explanation'] };

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
    const nutritionTextPart = { text: `당뇨병 환자를 위한 영양사로서 이 이미지의 음식을 분석해주세요. 음식 종류를 식별하고 양을 추정하여, 전체 식사에 대한 예상 영양 정보를 제공해주세요. 정확한 JSON 형식으로 응답해야 합니다.` };
    
    const nutritionResponse = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: { parts: [imagePart, nutritionTextPart] }, 
        config: { responseMimeType: "application/json", responseSchema: nutritionSchema } 
    });
    
    if (!nutritionResponse.text) throw new Error('API에서 영양 정보를 받지 못했습니다.');
    const nutrition = JSON.parse(nutritionResponse.text);
    
    const impactPrompt = `식사의 영양 정보는 다음과 같습니다: 총 탄수화물 ${nutrition.carbohydrates.total}g, 당류 ${nutrition.carbohydrates.sugars}g, 식이섬유 ${nutrition.carbohydrates.fiber}g, 혈당지수(GI) ${nutrition.glycemicIndex}. 일반적인 당뇨병 환자의 혈당에 미칠 가능성이 있는 영향을 예측하고, 결과를 분류하고, 간단한 설명을 한국어로 제공해주세요.`;
    
    const impactResponse = await ai.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: impactPrompt, 
        config: { responseMimeType: "application/json", responseSchema: impactSchema } 
    });

    if (!impactResponse.text) throw new Error('API에서 혈당 영향 정보를 받지 못했습니다.');
    const impact = JSON.parse(impactResponse.text);
    const level = impact.level.toUpperCase();
    if (!['STABLE', 'MODERATE', 'HIGH'].includes(level)) {
        throw new Error(`API에서 잘못된 혈당 영향 수준을 받았습니다: ${impact.level}`);
    }
    
    const responsePayload = { nutrition, impact: { level, explanation: impact.explanation } };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(responsePayload),
    };

  } catch (error) {
    console.error('Error in Netlify function:', error);
    const errorMessage = error.message || "서버에서 AI 분석 중 알 수 없는 오류가 발생했습니다.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};