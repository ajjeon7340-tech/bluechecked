
import { GoogleGenAI } from "@google/genai";
import { CreatorProfile } from "../types";

/**
 * Generates a reply draft using Gemini AI based on creator persona and fan message.
 */
export const generateReplyDraft = async (
  senderName: string,
  userMessage: string,
  creatorProfile: CreatorProfile
): Promise<string> => {
  // Use the API_KEY exclusively from environment variables (Vite compatible)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.warn("No API Key found");
    return "Hi there! Thanks for your message. (AI Draft unavailable - missing API Key)";
  }

  try {
    // Create a new instance right before the call as per guidelines
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      You are drafting a reply on behalf of a creator named ${creatorProfile.displayName}.
      Their persona is: ${creatorProfile.bio}.
      
      A fan named ${senderName} sent this message:
      "${userMessage}"

      Write a polite, helpful, and concise response (under 100 words).
      The tone should be professional yet warm.
      Do not add placeholders. Just write the message body.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
    });

    // Access .text property directly (not a method)
    return response.text?.trim() || "Thank you for your message! I'll get back to you shortly.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Thank you for reaching out! This is a placeholder as the AI service is currently unavailable.";
  }
};
