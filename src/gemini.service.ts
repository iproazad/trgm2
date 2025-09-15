import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  // Initialize the AI client directly with the environment variable.
  private ai: GoogleGenAI;

  constructor() {
    if (!process.env.API_KEY) {
      // This will prevent the service from being created if the API key is missing.
      // A more user-friendly message will be thrown from generateContent.
      console.error('مفتاح Gemini API غير متوفر. يرجى إعداده.');
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  private async generateContent(prompt: string, temperature: number, thinkingBudget?: number): Promise<string> {
    if (!this.ai) {
      throw new Error('مفتاح Gemini API غير متوفر. يرجى إعداده.');
    }
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature,
          ...(thinkingBudget !== undefined && { thinkingConfig: { thinkingBudget } })
        }
      });
      return response.text;
    } catch (error) {
       console.error('Error calling Gemini API:', error);
       if (error.toString().includes('API key not valid')) {
         throw new Error('مفتاح API الذي تم توفيره غير صالح.');
       }
       throw new Error('فشل الاتصال بخدمة Gemini.');
    }
  }

  async translateText(text: string, sourceLangName: string, targetLangName:string): Promise<string> {
    const prompt = `You are a professional translator. Translate the following text from "${sourceLangName}" to "${targetLangName}". Provide only the translated text, without any additional explanations, introductions, or quotation marks.
    
Text to translate:
"${text}"
`;
    // For translation, we want a direct, fast response with thinking disabled.
    return this.generateContent(prompt, 0.3, 0);
  }

  async spellCheckText(text: string, sourceLangName: string): Promise<string> {
    const prompt = `You are a meticulous spell and grammar checker. Correct any spelling mistakes and grammatical errors in the following text, which is in "${sourceLangName}". Respond ONLY with the corrected text. Do not add any introductions, explanations, or quotation marks. If the text is already perfect, return it as is.

Text to correct:
"${text}"
`;
    // For spell checking, we want a deterministic, fast response with thinking disabled.
    return this.generateContent(prompt, 0, 0);
  }
}
