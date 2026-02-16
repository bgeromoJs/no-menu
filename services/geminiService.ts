import { GoogleGenAI } from "@google/genai";

// Initialize the Google GenAI client using the API key from the environment.
// Always use process.env.API_KEY directly without fallbacks as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateProductDescription = async (productName: string): Promise<string> => {
  try {
    // Fixed: Added thinkingConfig when maxOutputTokens is set to follow Google GenAI guidelines.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Escreva uma descrição curta e apetitosa (em português) para um item de cardápio de batata recheada chamado "${productName}". A marca é "Vera's Batatas". Seja amigável e use emojis.`,
      config: {
        maxOutputTokens: 100,
        thinkingConfig: { thinkingBudget: 50 },
      },
    });
    // Access the 'text' property directly as per Google GenAI SDK guidelines.
    return response.text || "Descrição deliciosa em breve!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Um clássico da Vera's Batatas, feito com carinho.";
  }
};