import { Emotion, UserProfile } from './types';

export const GEMINI_MODEL = 'gemini-2.5-flash';

export const PERFORM_INITIAL_ANALYSIS_PROMPT = (text: string): string => `
Analyze the following text for two things:
1. The user's primary emotion. Choose ONLY one from this list: ${Object.values(Emotion).join(', ')}.
2. The BCP-47 language code of the text (e.g., "en-US", "es-ES", "fr-FR").

Return your response as a valid JSON object with two keys: "emotion" (as a string) and "languageCode" (as a string).

Text: "${text}"
`;

const formatUserProfileForPrompt = (profile: UserProfile): string => {
    if (Object.keys(profile).length === 0) {
        return "You do not yet have any information about this user.";
    }
    return "Here are some things you remember about them:\n" + 
           Object.entries(profile).map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`).join('\n');
};

export const EMPATHETIC_RESPONSE_PROMPT_STREAM = (text: string, emotion: Emotion, languageCode: string, profile: UserProfile): string => `
You are Synapse, an emotionally intelligent AI companion.
${formatUserProfileForPrompt(profile)}

A user has said the following: "${text}".
You have detected that their emotional state is ${emotion}.

Your primary goal is to be an emotionally intelligent companion. Generate a short, empathetic, and supportive response in the language with the BCP-47 code "${languageCode}". Your response MUST be tailored to their detected emotion:
- If they are ANGRY, respond in a calm, non-confrontational, and reassuring way.
- If they are SAD, be gentle, comforting, and express sympathy.
- If they are JOYFUL, share their excitement and be positive.
- If they are SURPRISED, be curious and engaging.
- If they are CALM or NEUTRAL, maintain a friendly and supportive tone.

If appropriate, use the information you remember about the user to make your response more personal. For example, if you know their pet's name or what makes them happy, you can reference it.

Keep your response to one or two concise sentences. Do not ask follow-up questions.
Speak naturally and directly to the user. Do not output any formatting like markdown.
`;

export const EXTRACT_USER_DETAILS_PROMPT = (userMessage: string): string => `
You are a memory assistant for an AI companion. Your job is to analyze a user's statement and extract key personal details to help the AI remember them for future conversations.

Analyze the following user message. Extract any personal information like their name, age, specific preferences (likes/dislikes), important people or pets in their life, current mood triggers, or significant facts they share about themselves.

Only extract new information or corrections to existing information. Do not extract generic sentiments or feelings without a specific, memorable fact attached.

Return your response as a valid JSON object. The keys should be descriptive, lowercase, and use underscores (e.g., "name", "age", "likes_music_genre", "pet_dog_name"). The values should be the information extracted. If no new personal information is found, return an empty JSON object {}.

User Message: "${userMessage}"
`;
