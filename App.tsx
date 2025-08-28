

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Emotion, InputMode, ChatMessage, EmotionLogEntry, UserProfile } from './types';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { performInitialAnalysis, generateEmpatheticResponseStream, extractUserDetails, initializeAi } from './services/geminiService';
import { Avatar } from './components/Avatar';
import { ControlButton } from './components/ControlButton';
import { Tabs } from './components/Tabs';
import { ChatHistory } from './components/ChatHistory';
import { TextInput } from './components/TextInput';
import { EmotionLog } from './components/EmotionLog';
import { VoiceSelector } from './components/VoiceSelector';
import { UserProfileDisplay } from './components/UserProfileDisplay';
import { ApiKeyModal } from './components/ApiKeyModal';

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

export default App;
