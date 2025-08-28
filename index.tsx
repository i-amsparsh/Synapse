
import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

const { useState, useEffect, useCallback, useRef, useMemo } = React;

// ================================================================================================
// INLINED FILE: types.ts
// ================================================================================================

enum AppState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
}

enum Emotion {
  NEUTRAL = 'NEUTRAL',
  JOYFUL = 'JOYFUL',
  CALM = 'CALM',
  ANGRY = 'ANGRY',
  SAD = 'SAD',
  SURPRISED = 'SURPRISED',
}

interface InitialAnalysis {
  emotion: Emotion;
  languageCode: string;
}

enum InputMode {
  VOICE = 'VOICE',
  TEXT = 'TEXT',
  PROFILE = 'PROFILE',
}

interface ChatMessage {
  sender: 'user' | 'ai';
  content: string;
  detectedEmotion?: Emotion;
}

interface EmotionLogEntry {
  userMessage: string;
  emotion: Emotion;
}

type UserProfile = Record<string, string>;

// ================================================================================================
// INLINED FILE: constants.ts
// ================================================================================================

const GEMINI_MODEL = 'gemini-2.5-flash';

const PERFORM_INITIAL_ANALYSIS_PROMPT = (text: string): string => `
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

const EMPATHETIC_RESPONSE_PROMPT_STREAM = (text: string, emotion: Emotion, languageCode: string, profile: UserProfile): string => `
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

const EXTRACT_USER_DETAILS_PROMPT = (userMessage: string): string => `
You are a memory assistant for an AI companion. Your job is to analyze a user's statement and extract key personal details to help the AI remember them for future conversations.

Analyze the following user message. Extract any personal information like their name, age, specific preferences (likes/dislikes), important people or pets in their life, current mood triggers, or significant facts they share about themselves.

Only extract new information or corrections to existing information. Do not extract generic sentiments or feelings without a specific, memorable fact attached.

Return your response as a valid JSON object. The keys should be descriptive, lowercase, and use underscores (e.g., "name", "age", "likes_music_genre", "pet_dog_name"). The values should be the information extracted. If no new personal information is found, return an empty JSON object {}.

User Message: "${userMessage}"
`;

// ================================================================================================
// INLINED FILE: services/geminiService.ts
// ================================================================================================

let ai: GoogleGenAI | null = null;

/**
 * Initializes the GoogleGenAI client with the provided API key.
 * This must be called before any other functions in this service.
 * @param apiKey The user's Google Gemini API key.
 */
const initializeAi = (apiKey: string) => {
    if (!apiKey) {
        throw new Error("API key is required to initialize the AI service.");
    }
    ai = new GoogleGenAI({ apiKey });
};

/**
 * Retrieves the initialized GoogleGenAI client.
 * @throws An error if the client has not been initialized.
 * @returns The initialized GoogleGenAI instance.
 */
const getAiClient = (): GoogleGenAI => {
    if (!ai) {
        throw new Error("AI Client has not been initialized. Call initializeAi(apiKey) first.");
    }
    return ai;
};

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
         throw new Error("The API key is not valid. Please check it and try again.");
    }
    
    // Generic error for other cases
    throw new Error("I'm having trouble connecting to my thoughts. Please try again later.");
};


const performInitialAnalysis = async (text: string): Promise<InitialAnalysis> => {
    const ai = getAiClient();
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

const generateEmpatheticResponseStream = async (text: string, analysis: InitialAnalysis, profile: UserProfile) => {
    const ai = getAiClient();
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

const extractUserDetails = async (userMessage: string): Promise<UserProfile | null> => {
    const ai = getAiClient();
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

// ================================================================================================
// INLINED FILE: hooks/useSpeechRecognition.ts
// ================================================================================================

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

interface UseSpeechRecognitionProps {
    onTurnEnd?: (transcript: string) => void;
}

const useSpeechRecognition = ({ onTurnEnd }: UseSpeechRecognitionProps = {}) => {
    const [interimText, setInterimText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const silenceTimerRef = useRef<number | null>(null);
    const turnTranscriptRef = useRef<string>('');
    const onTurnEndRef = useRef(onTurnEnd);

    useEffect(() => {
        onTurnEndRef.current = onTurnEnd;
    }, [onTurnEnd]);

    const processTurn = useCallback(() => {
        if (turnTranscriptRef.current.trim()) {
            onTurnEndRef.current?.(turnTranscriptRef.current.trim());
        }
        turnTranscriptRef.current = '';
        setInterimText('');
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
            // Process any remaining text when user manually stops
            processTurn();
            recognitionRef.current.stop();
        }
    }, [processTurn]);

    // Effect to clean up on component unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const startListening = useCallback(() => {
        if (isListening || !SpeechRecognitionAPI) {
            return;
        }

        turnTranscriptRef.current = '';
        setInterimText('');
        setError(null); // Reset error on a new attempt
        setIsListening(true);

        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        // By not setting recognition.lang, the browser will use its default language, enabling multi-language support.

        recognition.onresult = (event) => {
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }

            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    turnTranscriptRef.current += event.results[i][0].transcript + ' ';
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            
            setInterimText(interim);

            // Set a timer to process the turn after a pause
            silenceTimerRef.current = window.setTimeout(() => {
                processTurn();
            }, 1500); // 1.5 second pause
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setError(event.error);
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.onend = () => {
            // This is called when recognition ends, either naturally or via stop().
            setIsListening(false);
            recognitionRef.current = null;
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
        
        try {
            recognition.start();
        } catch (e) {
            console.error("Could not start recognition service:", e);
            setError("Speech service failed to start. It might be busy or disabled.");
            setIsListening(false);
            recognitionRef.current = null;
        }

    }, [isListening, processTurn]);

    return { interimText, isListening, error, startListening, stopListening, hasRecognitionSupport: !!SpeechRecognitionAPI, clearError };
};

// ================================================================================================
// INLINED FILE: hooks/useSpeechSynthesis.ts
// ================================================================================================

interface SpeakOptions {
    lang?: string;
    voiceURI?: string | null;
    onEnd?: () => void;
}

const useSpeechSynthesis = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const synthRef = useRef<SpeechSynthesis | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const synth = window.speechSynthesis;
            synthRef.current = synth;
            
            const handleVoicesChanged = () => {
                const availableVoices = synth.getVoices();
                if (availableVoices.length > 0) {
                    setVoices(availableVoices);
                }
            };

            synth.addEventListener('voiceschanged', handleVoicesChanged);
            handleVoicesChanged(); 

            return () => {
                synth.removeEventListener('voiceschanged', handleVoicesChanged);
            };
        }
    }, []);

    const speak = useCallback((text: string, options: SpeakOptions = {}) => {
        const { lang = 'en-US', voiceURI, onEnd } = options;
        const synth = synthRef.current;
        if (!synth || !text) return;

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (voices.length > 0) {
            let selectedVoice: SpeechSynthesisVoice | undefined;

            if (voiceURI) {
                selectedVoice = voices.find(voice => voice.voiceURI === voiceURI);
            }
            
            if (!selectedVoice) {
                const languageVoices = voices.filter(voice => voice.lang === lang);

                selectedVoice =
                    languageVoices.find(voice => /google/i.test(voice.name) && !voice.localService) ||
                    languageVoices.find(voice => /microsoft/i.test(voice.name) && !voice.localService) ||
                    languageVoices.find(voice => !voice.localService) ||
                    languageVoices[0]; 
            }
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
        }
        
        utterance.lang = utterance.voice ? utterance.voice.lang : lang;
        utterance.pitch = 1;
        utterance.rate = 1;

        utterance.onstart = () => {
            setIsSpeaking(true);
        };
        utterance.onend = () => {
            // Note: isSpeaking will be false only when the *entire queue* is empty.
            if (!synth.speaking) {
                setIsSpeaking(false);
            }
            if (onEnd) {
                onEnd();
            }
        };
        utterance.onerror = (event) => {
            console.error('Speech synthesis error', event.error);
             if (!synth.speaking) {
                setIsSpeaking(false);
            }
            if (onEnd) {
                onEnd(); 
            }
        };

        synth.speak(utterance);
    }, [voices]);

    const cancel = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
    }, []);

    return { speak, cancel, isSpeaking, voices, hasSynthesisSupport: !!(typeof window !== 'undefined' && 'speechSynthesis' in window) };
};

// ================================================================================================
// INLINED FILE: components/ApiKeyModal.tsx
// ================================================================================================

interface ApiKeyModalProps {
    onSubmit: (apiKey: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSubmit }) => {
    const [apiKey, setApiKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onSubmit(apiKey.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-8 max-w-md w-full m-4">
                <form onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-bold text-slate-100 mb-4">Enter API Key</h2>
                    <p className="text-slate-400 mb-6">
                        To use Synapse AI, please provide your Google Gemini API key. Your key will only be stored in your browser for this session.
                    </p>
                    <div className="mb-6">
                        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">
                            Gemini API Key
                        </label>
                        <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="text-input w-full"
                            placeholder="Enter your API key here"
                            required
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-400"
                    >
                        Save and Continue
                    </button>
                </form>
            </div>
        </div>
    );
};

// ================================================================================================
// INLINED FILE: components/Avatar.tsx
// ================================================================================================

interface AvatarProps {
  state: AppState;
  emotion: Emotion;
}

const Eye: React.FC<{ cx: number }> = ({ cx }) => (
    <ellipse cx={cx} cy="100" rx="8" ry="12" className="fill-white" />
);

const Mouth: React.FC<{ state: AppState, emotion: Emotion }> = ({ state, emotion }) => {
    if (state === AppState.SPEAKING) {
        return (
            <ellipse cx="100" cy="140" rx="20" ry="8" className="fill-white animate-speak" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        );
    }
    
    let pathData = "M 85 135 Q 100 140 115 135"; // Neutral
    if (state !== AppState.THINKING) {
        switch (emotion) {
            case Emotion.JOYFUL:
                pathData = "M 85 135 Q 100 150 115 135";
                break;
            case Emotion.SAD:
                pathData = "M 85 140 Q 100 130 115 140";
                break;
            case Emotion.SURPRISED:
                 return <circle cx="100" cy="140" r="8" className="fill-white" />;
        }
    }

    if (state === AppState.THINKING) {
        pathData = "M 90 140 L 110 140"; // Flat line for thinking
    }

    return (
        <path
            d={pathData}
            stroke="white"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            className="transition-all duration-300"
        />
    );
};

const ThinkingIndicator: React.FC = () => (
    <g>
        {[0, 1, 2].map((i) => (
            <circle
                key={i}
                cx="100"
                cy="45"
                r="4"
                fill="white"
                opacity="0"
                transform={`rotate(${i * 120} 100 100)`}
            >
                <animate
                    attributeName="opacity"
                    values="0;1;0"
                    dur="1.5s"
                    begin={`${i * 0.25}s`}
                    repeatCount="indefinite"
                />
            </circle>
        ))}
    </g>
);

const Avatar: React.FC<AvatarProps> = ({ state, emotion }) => {
    const getGradientColors = () => {
        switch (emotion) {
            case Emotion.JOYFUL: return ["#FBBF24", "#F97316"]; // yellow-400 to orange-500
            case Emotion.CALM: return ["#4ADE80", "#14B8A6"]; // green-400 to teal-500
            case Emotion.SAD: return ["#3B82F6", "#4F46E5"]; // blue-500 to indigo-600
            case Emotion.ANGRY: return ["#EF4444", "#8B5CF6"]; // red-500 to purple-600
            case Emotion.SURPRISED: return ["#F472B6", "#F43F5E"]; // pink-400 to rose-500
            default: return ["#38BDF8", "#2563EB"]; // sky-400 to blue-600
        }
    };
    
    const [colorFrom, colorTo] = getGradientColors();

    return (
        <div className="relative w-64 h-64">
             <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                <defs>
                    <radialGradient id="avatarGradient" cx="35%" cy="35%" r="75%">
                        <stop offset="0%" stopColor={colorFrom} className="transition-all duration-500" />
                        <stop offset="100%" stopColor={colorTo} className="transition-all duration-500" />
                    </radialGradient>
                </defs>
                <circle cx="100" cy="100" r="95" fill="url(#avatarGradient)" />
                 
                <Eye cx={80} />
                <Eye cx={120} />

                <Mouth state={state} emotion={emotion} />

                {state === AppState.THINKING && <ThinkingIndicator />}
            </svg>
        </div>
    );
};

// ================================================================================================
// INLINED FILE: components/ChatHistory.tsx
// ================================================================================================

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
  interimUserMessage?: string;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, isThinking, interimUserMessage }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, interimUserMessage]);

  return (
    <div className="chat-history w-full flex-grow overflow-y-auto p-2 flex flex-col gap-4">
      {messages.map((msg, index) => (
        <div key={index} className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}>
          <div className={`chat-bubble ${msg.sender === 'user' ? 'user' : 'ai'}`}>
            {msg.sender === 'ai' && msg.detectedEmotion && (
              <div className="flex items-center gap-2 mb-2 border-b border-slate-600 pb-2">
                <EmotionIndicator emotion={msg.detectedEmotion} className="w-4 h-4" />
                <span className="text-xs text-slate-400 font-medium">Detected Emotion</span>
              </div>
            )}
            {msg.content}
          </div>
        </div>
      ))}
      {isThinking && (
        <div className="chat-bubble-wrapper self-start">
            <div className="chat-bubble ai">
                <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
      )}
      {interimUserMessage && (
        <div className="chat-bubble-wrapper self-end">
            <div className="chat-bubble user opacity-70">
                {interimUserMessage}
            </div>
        </div>
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

// ================================================================================================
// INLINED FILE: components/ControlButton.tsx
// ================================================================================================

interface ControlButtonProps {
    onClick: () => void;
    isListening: boolean;
    isProcessing: boolean;
}

const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.9999 14.9497C10.1818 14.9497 8.70996 13.4778 8.70996 11.6597V6.33966C8.70996 4.52159 10.1818 3.04968 11.9999 3.04968C13.818 3.04968 15.29 4.52159 15.29 6.33966V11.6597C15.29 13.4778 13.818 14.9497 11.9999 14.9497ZM11.9999 17.0997C14.7509 17.0997 17.0179 14.8327 17.0179 12.0817H19.1679C19.1679 15.3187 16.6579 17.9817 13.7179 18.4217V20.9997H10.2819V18.4217C7.34193 17.9817 4.83191 15.3187 4.83191 12.0817H6.98192C6.98192 14.8327 9.24894 17.0997 11.9999 17.0997Z"></path>
    </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M6 5H18C18.5523 5 19 5.44772 19 6V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6C5 5.44772 5.44772 5 6 5Z"></path>
    </svg>
);


const ControlButton: React.FC<ControlButtonProps> = ({ onClick, isListening, isProcessing }) => {
    const baseClasses = "w-24 h-24 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg";
    
    let activeClasses = "";
    let icon = <MicrophoneIcon className="text-white w-10 h-10" />;
    let label = 'Start listening';

    if (isProcessing && !isListening) {
        // AI is thinking or speaking
        activeClasses = "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400";
        icon = <StopIcon className="text-white w-10 h-10" />;
        label = 'Stop processing';
    } else if (isListening) {
        // App is actively listening for user input
        activeClasses = "bg-red-500 hover:bg-red-600 focus:ring-red-400 animate-pulse-glow";
        icon = <MicrophoneIcon className="text-white w-10 h-10" />;
        label = 'Stop listening';
    } else {
        // Default idle state
        activeClasses = "bg-green-500 hover:bg-green-600 focus:ring-green-400";
        label = 'Start listening';
    }

    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${activeClasses}`}
            aria-label={label}
        >
            {icon}
        </button>
    );
};

// ================================================================================================
// INLINED FILE: components/EmotionIndicator.tsx
// ================================================================================================

interface EmotionIndicatorProps {
  emotion: Emotion;
  className?: string;
}

const emotionMap: Record<Emotion, { icon: JSX.Element, color: string, label: string }> = {
    [Emotion.JOYFUL]: {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
        ),
        color: 'text-yellow-400',
        label: 'Joyful',
    },
    [Emotion.SAD]: {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5-2 4-2 4 2 4 2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
        ),
        color: 'text-blue-400',
        label: 'Sad',
    },
    [Emotion.ANGRY]: {
        icon: (
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                <path d="M7.5 8l2 2"></path>
                <path d="M14.5 10l2-2"></path>
             </svg>
        ),
        color: 'text-red-500',
        label: 'Angry',
    },
    [Emotion.SURPRISED]: {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
        ),
        color: 'text-pink-400',
        label: 'Surprised',
    },
    [Emotion.CALM]: {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14h8"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
        ),
        color: 'text-green-400',
        label: 'Calm',
    },
    [Emotion.NEUTRAL]: {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="14" x2="16" y2="14"></line>
            </svg>
        ),
        color: 'text-slate-400',
        label: 'Neutral',
    },
};

const EmotionIndicator: React.FC<EmotionIndicatorProps> = ({ emotion, className = 'w-5 h-5' }) => {
    const { icon, color, label } = emotionMap[emotion] || emotionMap[Emotion.NEUTRAL];

    return (
        <div className={`${className} ${color}`} title={`Detected Emotion: ${label}`} aria-label={`Detected Emotion: ${label}`}>
            {icon}
        </div>
    );
};

// ================================================================================================
// INLINED FILE: components/EmotionLog.tsx
// ================================================================================================

interface EmotionLogProps {
  entries: EmotionLogEntry[];
}

const emotionLabelMap: Record<Emotion, string> = {
    [Emotion.NEUTRAL]: 'Neutral',
    [Emotion.JOYFUL]: 'Joyful',
    [Emotion.CALM]: 'Calm',
    [Emotion.ANGRY]: 'Angry',
    [Emotion.SAD]: 'Sad',
    [Emotion.SURPRISED]: 'Surprised',
}

const EmotionLog: React.FC<EmotionLogProps> = ({ entries }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full max-h-[40vh] sm:max-h-[50vh] lg:max-h-[calc(100vh-250px)] flex flex-col shadow-inner">
      <h2 className="text-xl font-bold text-slate-200 mb-4 border-b border-slate-700 pb-2 flex-shrink-0">
        Emotion Log
      </h2>
      {entries.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-center text-slate-500 p-4">
          <p>Your conversation's emotional journey will appear here.</p>
        </div>
      ) : (
        <div className="overflow-y-auto space-y-3 pr-2 chat-history flex-grow">
          {entries.slice().reverse().map((entry, index) => (
            <div key={index} className="bg-slate-700/50 p-3 rounded-md flex items-start gap-3 animate-fade-in">
              <div className="flex-shrink-0 pt-1">
                <EmotionIndicator emotion={entry.emotion} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm text-slate-400 italic truncate">You said: "{entry.userMessage}"</p>
                <p className="font-semibold text-slate-200">Detected: <span className="font-bold">{emotionLabelMap[entry.emotion]}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

{
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in {
        animation: fade-in 0.3s ease-out forwards;
      }
    `;
    document.head.append(style);
}

// ================================================================================================
// INLINED FILE: components/Tabs.tsx
// ================================================================================================

interface TabsProps {
  activeTab: InputMode;
  onTabChange: (tab: InputMode) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const getTabClasses = (tab: InputMode) => {
    const base = "px-4 py-2 text-lg font-medium transition-colors duration-200 focus:outline-none rounded-t-md";
    const active = "text-sky-300 border-b-2 border-sky-300";
    const inactive = "text-slate-400 hover:text-slate-200";
    return `${base} ${activeTab === tab ? active : inactive}`;
  };

  return (
    <div className="flex justify-center gap-8 border-b border-slate-700 w-full max-w-md">
      <button onClick={() => onTabChange(InputMode.VOICE)} className={getTabClasses(InputMode.VOICE)}>
        Voice
      </button>
      <button onClick={() => onTabChange(InputMode.TEXT)} className={getTabClasses(InputMode.TEXT)}>
        Text
      </button>
      <button onClick={() => onTabChange(InputMode.PROFILE)} className={getTabClasses(InputMode.PROFILE)}>
        Profile
      </button>
    </div>
  );
};

// ================================================================================================
// INLINED FILE: components/TextInput.tsx
// ================================================================================================

interface TextInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
}

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M3 13.0001H9V11.0001H3V1.8451L22.292 12.0001L3 22.1551V13.0001Z"></path>
    </svg>
);

const TextInput: React.FC<TextInputProps> = ({ onSendMessage, disabled }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message..."
        disabled={disabled}
        className="text-input flex-grow"
        aria-label="Chat message input"
      />
      <button type="submit" disabled={disabled} className="send-button" aria-label="Send message">
        <SendIcon className="w-6 h-6" />
      </button>
    </form>
  );
};

// ================================================================================================
// INLINED FILE: components/UserProfileDisplay.tsx
// ================================================================================================

interface UserProfileDisplayProps {
  profile: UserProfile;
  onClearProfile: () => void;
}

const UserProfileDisplay: React.FC<UserProfileDisplayProps> = ({ profile, onClearProfile }) => {
    const profileEntries = Object.entries(profile);

    const formatKey = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-auto my-4 text-white shadow-lg animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 mb-4">
                <h2 className="text-2xl font-bold text-slate-100">AI Memory</h2>
                <button
                    onClick={onClearProfile}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={profileEntries.length === 0}
                    aria-label="Clear all remembered information"
                >
                    Clear Memory
                </button>
            </div>
            {profileEntries.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                    <p className="text-lg">The AI hasn't learned anything about you yet.</p>
                    <p className="text-sm">Share some details in your conversation to personalize your experience.</p>
                </div>
            ) : (
                <div className="space-y-3 chat-history pr-2 overflow-y-auto max-h-80">
                    {profileEntries.map(([key, value]) => (
                        <div key={key} className="bg-slate-700/50 p-3 rounded-md grid grid-cols-3 gap-4 items-center">
                            <strong className="text-slate-300 font-semibold col-span-1">{formatKey(key)}:</strong>
                            <span className="text-slate-200 col-span-2 break-words">{value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

{
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .animate-fade-in {
        animation: fade-in 0.5s ease-out forwards;
      }
    `;
    document.head.append(style);
}


// ================================================================================================
// INLINED FILE: components/VoiceSelector.tsx
// ================================================================================================

interface VoiceSelectorProps {
    voices: SpeechSynthesisVoice[];
    selectedVoiceURI: string | null;
    onVoiceChange: (uri: string) => void;
    disabled: boolean;
}

const generateVoiceTooltip = (voice: SpeechSynthesisVoice): string => {
    const characteristicsKeywords = ['neural', 'natural', 'premium', 'enhanced', 'hd', 'wavenet', 'pro'];
    const nameLower = voice.name.toLowerCase();
    const foundChars = characteristicsKeywords.filter(char => nameLower.includes(char));

    const parts = [`Language: ${voice.lang}`];
    if (foundChars.length > 0) {
        const capitalizedChars = foundChars.map(c => c.charAt(0).toUpperCase() + c.slice(1));
        parts.push(`Type: ${capitalizedChars.join(', ')}`);
    }
    
    parts.push(voice.localService ? 'Local' : 'Network');

    return parts.join(' • ');
};

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedVoiceURI, onVoiceChange, disabled }) => {
    const groupedVoices = useMemo(() => {
        return voices.reduce((acc, voice) => {
            const lang = voice.lang;
            if (!acc[lang]) {
                acc[lang] = [];
            }
            acc[lang].push(voice);
            return acc;
        }, {} as Record<string, SpeechSynthesisVoice[]>);
    }, [voices]);

    return (
        <div className="w-full max-w-sm mx-auto">
            <label htmlFor="voice-selector" className="block text-sm font-medium text-slate-400 mb-1">
                AI Voice
            </label>
            <select
                id="voice-selector"
                value={selectedVoiceURI || ''}
                onChange={(e) => onVoiceChange(e.target.value)}
                disabled={disabled || voices.length === 0}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-400 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Select a voice for the AI"
            >
                {voices.length === 0 ? (
                    <option>Loading voices...</option>
                ) : (
                    Object.entries(groupedVoices).map(([lang, voiceGroup]) => (
                        <optgroup key={lang} label={lang}>
                            {voiceGroup.map(voice => (
                                <option
                                    key={voice.voiceURI}
                                    value={voice.voiceURI}
                                    title={generateVoiceTooltip(voice)}
                                >
                                    {voice.name} ({voice.lang})
                                </option>
                            ))}
                        </optgroup>
                    ))
                )}
            </select>
        </div>
    );
};

// ================================================================================================
// INLINED FILE: App.tsx
// ================================================================================================

const USER_PROFILE_STORAGE_KEY = 'synapse-ai-user-profile';
const API_KEY_STORAGE_KEY = 'synapse-ai-api-key';

const App: React.FC = () => {
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [appState, setAppState] = useState<AppState>(AppState.IDLE);
    const [emotion, setEmotion] = useState<Emotion>(Emotion.NEUTRAL);
    const [inputMode, setInputMode] = useState<InputMode>(InputMode.VOICE);
    const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile>({});
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    
    // Check for API key on initial load
    useEffect(() => {
        try {
            const storedKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
            if (storedKey) {
                initializeAi(storedKey);
                setIsInitialized(true);
            }
        } catch (error) {
            console.error("Failed to initialize with stored API key:", error);
            sessionStorage.removeItem(API_KEY_STORAGE_KEY);
        }
    }, []);

    // Load user profile from local storage on initial render
    useEffect(() => {
        if (!isInitialized) return;
        try {
            const storedProfile = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
            if (storedProfile) {
                setUserProfile(JSON.parse(storedProfile));
            }
        } catch (error) {
            console.error("Failed to load user profile from local storage:", error);
        }
    }, [isInitialized]);

    // Save user profile to local storage whenever it changes
    useEffect(() => {
        if (!isInitialized) return;
        try {
            localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
        } catch (error) {
            console.error("Failed to save user profile to local storage:", error);
        }
    }, [userProfile, isInitialized]);

    const { speak, cancel, isSpeaking, voices } = useSpeechSynthesis();
    
    const processUserRequest = useCallback(async (userText: string) => {
        if (!userText) return;

        setAppState(AppState.THINKING);
        setConversationHistory(prev => [...prev, { sender: 'user', content: userText }]);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const analysis = await performInitialAnalysis(userText);
            setEmotion(analysis.emotion);

            // Add a placeholder for the AI's response to enable streaming into the chat
            const aiMessagePlaceholder: ChatMessage = { sender: 'ai', content: '', detectedEmotion: analysis.emotion };
            setConversationHistory(prev => [...prev, aiMessagePlaceholder]);

            const responseStream = await generateEmpatheticResponseStream(userText, analysis, userProfile);
            
            let fullResponse = "";
            setAppState(AppState.SPEAKING);

            const streamAndSpeak = async () => {
                let textBuffer = "";
                for await (const chunk of responseStream) {
                    if (controller.signal.aborted) return;
                    const chunkText = chunk.text;
                    fullResponse += chunkText;
                    textBuffer += chunkText;

                    // Stream response directly into the last message in history
                    setConversationHistory(prev => {
                        const newHistory = [...prev];
                        if (newHistory.length > 0 && newHistory[newHistory.length - 1].sender === 'ai') {
                           newHistory[newHistory.length - 1].content = fullResponse;
                        }
                        return newHistory;
                    });


                    if (/[.!?]/.test(textBuffer)) {
                        const sentences = textBuffer.match(/[^.!?]+[.!?]+/g);
                        if (sentences) {
                            const sentenceToSpeak = sentences.join(' ');
                            textBuffer = textBuffer.substring(sentenceToSpeak.length);
                            if (inputMode === InputMode.VOICE) {
                                speak(sentenceToSpeak, { lang: analysis.languageCode, voiceURI: selectedVoiceURI });
                            }
                        }
                    }
                }
                if (textBuffer.trim() && !controller.signal.aborted && inputMode === InputMode.VOICE) {
                    await new Promise<void>(resolve => {
                        speak(textBuffer.trim(), { 
                            lang: analysis.languageCode, 
                            voiceURI: selectedVoiceURI,
                            onEnd: () => resolve()
                        });
                    });
                }
            };
            
            await streamAndSpeak();

            if (controller.signal.aborted) {
                // Clean up by removing the empty AI message placeholder if aborted
                setConversationHistory(prev => prev.filter(m => m.content !== '' || m.sender !== 'ai' || m.detectedEmotion !== analysis.emotion));
                setAppState(AppState.IDLE);
                setEmotion(Emotion.NEUTRAL);
                return;
            };
            
            // Don't extract details if the request was aborted.
            const extractedDetails = await extractUserDetails(userText);
            if (extractedDetails && Object.keys(extractedDetails).length > 0) {
                setUserProfile(prevProfile => ({ ...prevProfile, ...extractedDetails }));
            }

        } catch (error: any) {
            console.error("Error processing user request:", error);
            setAppState(AppState.ERROR);
            setConversationHistory(prev => {
                const newHistory = [...prev];
                const lastMessage = newHistory[newHistory.length - 1];
                if (lastMessage && lastMessage.sender === 'ai') {
                    lastMessage.content = error.message || "I seem to be having trouble connecting. Please try again later.";
                }
                return newHistory;
            });
        } finally {
             if (!controller.signal.aborted) {
                setAppState(AppState.IDLE);
                setEmotion(Emotion.NEUTRAL);
                abortControllerRef.current = null;
            }
        }
    }, [inputMode, speak, selectedVoiceURI, userProfile]);

    const { interimText, isListening, error: recognitionError, startListening, stopListening, clearError } = useSpeechRecognition({ onTurnEnd: processUserRequest });

    // Select a default voice once they are loaded
    useEffect(() => {
        if (voices.length > 0 && !selectedVoiceURI) {
            const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en')) || voices[0];
            if (defaultVoice) {
                setSelectedVoiceURI(defaultVoice.voiceURI);
            }
        }
    }, [voices, selectedVoiceURI]);

    const handleClearProfile = useCallback(() => {
        if (window.confirm("Are you sure you want to erase all of the AI's memories about you? This action cannot be undone.")) {
            setUserProfile({});
        }
    }, []);
    
    useEffect(() => {
        return () => {
            cancel();
            abortControllerRef.current?.abort();
        };
    }, [cancel]);

    const isProcessing = ![AppState.IDLE, AppState.ERROR, AppState.LISTENING].includes(appState);

    const handleMicClick = useCallback(() => {
        // If AI is thinking or speaking, the button acts as an interrupt
        if (isProcessing) {
            abortControllerRef.current?.abort();
            cancel();
            setAppState(AppState.IDLE);
            setEmotion(Emotion.NEUTRAL);
            return;
        }

        // Otherwise, it toggles listening on and off
        if (isListening) {
            stopListening();
        } else {
            if (recognitionError) clearError();
            setAppState(AppState.LISTENING);
            startListening();
        }
    }, [isListening, stopListening, startListening, recognitionError, clearError, isProcessing, cancel]);

    const handleApiKeySubmit = (key: string) => {
        try {
            initializeAi(key);
            sessionStorage.setItem(API_KEY_STORAGE_KEY, key);
            setIsInitialized(true);
        } catch (error) {
            console.error("Failed to initialize with provided API key:", error);
            alert("There was an error initializing the AI with that key. Please check the console for details.");
        }
    };

    if (!isInitialized) {
        return <ApiKeyModal onSubmit={handleApiKeySubmit} />;
    }

    const emotionLogEntries: EmotionLogEntry[] = conversationHistory
        .reduce((acc, msg, index) => {
            if (msg.sender === 'ai' && msg.detectedEmotion) {
                for (let i = index - 1; i >= 0; i--) {
                    if (conversationHistory[i].sender === 'user') {
                        acc.push({
                            userMessage: conversationHistory[i].content,
                            emotion: msg.detectedEmotion,
                        });
                        break;
                    }
                }
            }
            return acc;
        }, [] as EmotionLogEntry[]);

    const renderContent = () => {
        if (inputMode === InputMode.PROFILE) {
            return <UserProfileDisplay profile={userProfile} onClearProfile={handleClearProfile} />;
        }
        
        return (
            <div className="w-full max-w-md mx-auto flex flex-col h-full gap-4">
                 {inputMode === InputMode.VOICE ? (
                    <>
                        <ChatHistory 
                            messages={conversationHistory} 
                            isThinking={appState === AppState.THINKING} 
                            interimUserMessage={isListening ? interimText : undefined}
                        />
                        <div className="flex-shrink-0 w-full flex flex-col items-center gap-4 pt-4 border-t border-slate-700">
                            <ControlButton 
                                onClick={handleMicClick} 
                                isListening={isListening} 
                                isProcessing={isProcessing}
                            />
                            <div className="w-full">
                               {voices.length > 0 && <VoiceSelector voices={voices} selectedVoiceURI={selectedVoiceURI} onVoiceChange={setSelectedVoiceURI} disabled={isProcessing || isListening} />}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <ChatHistory messages={conversationHistory} isThinking={appState === AppState.THINKING} />
                        <TextInput onSendMessage={processUserRequest} disabled={isProcessing} />
                    </>
                )}
            </div>
        );
    }
    
    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center p-4 selection:bg-sky-500 selection:text-white">
            <header className="text-center my-6">
                <h1 className="text-5xl font-bold text-slate-100">Synapse AI</h1>
                <p className="text-slate-400 mt-2">Your Emotionally Intelligent Companion</p>
            </header>
            <main className="w-full max-w-7xl mx-auto flex-grow flex lg:flex-row flex-col items-stretch justify-center gap-8 p-4">
                <div className="w-full lg:w-1/4 flex flex-col items-center justify-start gap-6">
                    <Avatar state={appState} emotion={emotion} />
                </div>
                 <div className="w-full lg:w-1/2 flex flex-col items-center gap-4">
                    <Tabs activeTab={inputMode} onTabChange={(mode) => { cancel(); stopListening(); setAppState(AppState.IDLE); setInputMode(mode); }} />
                    <div className="w-full flex-grow flex flex-col p-4 bg-slate-800/50 rounded-lg">
                       {renderContent()}
                    </div>
                </div>
                <div className="w-full lg:w-1/4">
                    <EmotionLog entries={emotionLogEntries} />
                </div>
            </main>
        </div>
    );
};


// ================================================================================================
// FINAL RENDER CALL
// ================================================================================================

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
