
import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL, PERFORM_INITIAL_ANALYSIS_PROMPT, EMPATHETIC_RESPONSE_PROMPT_STREAM, EXTRACT_USER_DETAILS_PROMPT } from '../constants';
import { Emotion, InitialAnalysis, UserProfile } from '../types';

if (!process.env.API_KEY) {
    // This provides a clearer, more immediate warning if the API key is missing.
    alert("CRITICAL ERROR: API_KEY environment variable not set. The application will not be able to communicate with the AI.");
    console.error("API_KEY environment variable not set. App may not function correctly.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * A centralized error handler for Gemini API calls.
 * It checks for common issues like rate limiting and invalid API keys,
 * and throws a user-friendly error message.
 * @param error The error object caught from the API call.
 * @param functionName The name of the function where the error occurred, for logging.
 * @throws An `Error` with a user-friendly message.
 */
const handleApiError = (error: any, functionName: string): never => {
    console.error(`Error in ${functionName}:`, error);
    const errorMessage = error.toString();

    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        throw new Error("I'm feeling a bit overwhelmed right now. Please give me a moment before trying again.");
    }
    if (errorMessage.includes('API key not valid')) {
         throw new Error("The API key is not configured correctly. Please check the setup.");
    }
    
    // Generic error for other cases
    throw new Error("I'm having trouble connecting to my thoughts. Please try again later.");
};


export const performInitialAnalysis = async (text: string): Promise<InitialAnalysis> => {
    try {
        const prompt = PERFORM_INITIAL_ANALYSIS_PROMPT(text);
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        emotion: { type: Type.STRING, enum: Object.values(Emotion) },
                        languageCode: { type: Type.STRING },
                    },
                    required: ["emotion", "languageCode"],
                },
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        
        const result = JSON.parse(response.text);

        if (result.emotion && result.languageCode) {
             return {
                emotion: result.emotion as Emotion,
                languageCode: result.languageCode,
            };
        } else {
             throw new Error("Invalid analysis response structure.");
        }

    } catch (error) {
        handleApiError(error, 'performInitialAnalysis');
    }
};

export const generateEmpatheticResponseStream = async (text: string, analysis: InitialAnalysis, profile: UserProfile) => {
    try {
        const prompt = EMPATHETIC_RESPONSE_PROMPT_STREAM(text, analysis.emotion, analysis.languageCode, profile);
        const response = await ai.models.generateContentStream({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                // Disable thinking for faster, more conversational responses.
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response;
    } catch (error) {
        handleApiError(error, 'generateEmpatheticResponseStream');
    }
};

export const extractUserDetails = async (userMessage: string): Promise<UserProfile | null> => {
    try {
        const prompt = EXTRACT_USER_DETAILS_PROMPT(userMessage);
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                // We don't define a schema here because the keys can be anything.
                // We rely on the model to return a valid JSON object.
                // Disable thinking for faster background processing.
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        const resultText = response.text.trim();
        if (resultText === '{}') {
            return null; // No new details found
        }
        
        const result = JSON.parse(resultText);
        
        // Basic validation
        if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
            return result;
        }
        return null;

    } catch (error) {
        handleApiError(error, 'extractUserDetails');
    }
};
