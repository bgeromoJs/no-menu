
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateProductDescription = async (productName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Escreva uma descrição curta e apetitosa (em português) para um item de cardápio de batata recheada chamado "${productName}". A marca é "Vera's Batatas". Seja amigável e use emojis.`,
      config: {
        maxOutputTokens: 100,
      },
    });
    return response.text || "Descrição deliciosa em breve!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Um clássico da Vera's Batatas, feito com carinho.";
  }
};
