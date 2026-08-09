import { GoogleGenAI } from '@google/genai';
import { FALLBACK_REPLIES } from '../constants';
import { Message } from '../types';

const apiKey = process.env.API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const randomFallback = () => FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];

export const generateReply = async (persona: string, history: Message[]): Promise<string> => {
  if (!ai) return randomFallback();

  try {
    const recent = history.slice(-8).map(m => {
      const speaker = m.sender === 'me' ? 'Usuario' : 'Tú';
      const content = m.kind === 'text' ? m.text : m.kind === 'sticker' ? '[envió un sticker]' : '[llamada]';
      return `${speaker}: ${content}`;
    }).join('\n');

    const prompt = `Eres ${persona}. Estás chateando por la app PolloChat (similar a WhatsApp) con un amigo. ` +
      `Responde en español, de forma breve (máximo 20 palabras), natural y cálida, con emojis ocasionales. ` +
      `No uses comillas ni menciones que eres una IA.\n\nConversación reciente:\n${recent}\n\nTú:`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text?.trim();
    return text || randomFallback();
  } catch (error) {
    console.error('Error generating chat reply:', error);
    return randomFallback();
  }
};
