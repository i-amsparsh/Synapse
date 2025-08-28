import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Emotion, InputMode, ChatMessage, EmotionLogEntry, UserProfile } from './types';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { performInitialAnalysis, generateEmpatheticResponseStream, extractUserDetails } from './services/geminiService';
import { Avatar } from './components/Avatar';
import { ControlButton } from './components/ControlButton';
import { StatusDisplay } from './components/StatusDisplay';
import { Tabs } from './components/Tabs';
import { ChatHistory } from './components/ChatHistory';
import { TextInput } from './components/TextInput';
import { EmotionLog } from './components/EmotionLog';
import { VoiceSelector } from './components/VoiceSelector';
import { UserProfileDisplay } from './components/UserProfileDisplay';

const USER_PROFILE_STORAGE_KEY = 'synapse-ai-user-profile';

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.IDLE);
    const [emotion, setEmotion] = useState<Emotion>(Emotion.NEUTRAL);
    const [inputMode, setInputMode] = useState<InputMode>(InputMode.VOICE);
    const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile>({});

    // States primarily for the voice UI's display
    const [userSaidText, setUserSaidText] = useState('');
    const [aiSaidText, setAiSaidText] = useState('');
    const [detectedEmotionForDisplay, setDetectedEmotionForDisplay] = useState<Emotion | null>(null);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Load user profile from local storage on initial render
    useEffect(() => {
        try {
            const storedProfile = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
            if (storedProfile) {
                setUserProfile(JSON.parse(storedProfile));
            }
        } catch (error) {
            console.error("Failed to load user profile from local storage:", error);
        }
    }, []);

    // Save user profile to local storage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(userProfile));
        } catch (error) {
            console.error("Failed to save user profile to local storage:", error);
        }
    }, [userProfile]);

    const { speak, cancel, isSpeaking, voices } = useSpeechSynthesis();
    const { text: recognizedText, interimText, isListening, error: recognitionError, startListening, stopListening, hasRecognitionSupport, clearError } = useSpeechRecognition();

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

    const processUserRequest = useCallback(async (userText: string) => {
        if (!userText) return;

        setAppState(AppState.THINKING);
        setUserSaidText(userText);
        setAiSaidText('');
        setConversationHistory(prev => [...prev, { sender: 'user', content: userText }]);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const analysis = await performInitialAnalysis(userText);
            setEmotion(analysis.emotion);
            setDetectedEmotionForDisplay(analysis.emotion);

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
                    setAiSaidText(fullResponse);

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
                setAppState(AppState.IDLE);
                setEmotion(Emotion.NEUTRAL);
                return;
            };
            
            setConversationHistory(prev => [...prev, { sender: 'ai', content: fullResponse, detectedEmotion: analysis.emotion }]);

            // Don't extract details if the request was aborted.
            const extractedDetails = await extractUserDetails(userText);
            if (extractedDetails && Object.keys(extractedDetails).length > 0) {
                setUserProfile(prevProfile => ({ ...prevProfile, ...extractedDetails }));
            }

        } catch (error: any) {
            console.error("Error processing user request:", error);
            setAppState(AppState.ERROR);
            setAiSaidText(error.message || "I seem to be having trouble connecting. Please try again later.");
        } finally {
             if (!controller.signal.aborted) {
                setAppState(AppState.IDLE);
                setEmotion(Emotion.NEUTRAL);
                abortControllerRef.current = null;
            }
        }
    }, [inputMode, speak, selectedVoiceURI, userProfile]);

    useEffect(() => {
        // FIX: Only process recognized text if the app is idle to prevent race conditions and API spam.
        if (recognizedText && appState === AppState.IDLE) {
            processUserRequest(recognizedText);
        }
    }, [recognizedText, processUserRequest, appState]);
    
    useEffect(() => {
        return () => {
            cancel();
            abortControllerRef.current?.abort();
        };
    }, [cancel]);

    const handleMicClick = useCallback(() => {
        if (appState !== AppState.IDLE && appState !== AppState.LISTENING) {
            // Cancel any ongoing thinking or speaking
            abortControllerRef.current?.abort();
            cancel();
            setAppState(AppState.IDLE);
            setEmotion(Emotion.NEUTRAL);
            setUserSaidText('');
            setAiSaidText('');
            setDetectedEmotionForDisplay(null);
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            setUserSaidText('');
            setAiSaidText('');
            setDetectedEmotionForDisplay(null);
            if (recognitionError) clearError();
            setAppState(AppState.LISTENING);
            startListening();
        }
    }, [isListening, stopListening, startListening, recognitionError, clearError, appState, cancel]);

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

    const isProcessing = ![AppState.IDLE, AppState.ERROR].includes(appState);

    const renderContent = () => {
        if (inputMode === InputMode.PROFILE) {
            return <UserProfileDisplay profile={userProfile} onClearProfile={handleClearProfile} />;
        }
        
        return (
            <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-4">
                 {inputMode === InputMode.VOICE ? (
                    <>
                        <StatusDisplay
                            state={appState}
                            userText={userSaidText}
                            interimText={interimText}
                            aiText={aiSaidText}
                            detectedEmotion={detectedEmotionForDisplay}
                        />
                        <ControlButton 
                            onClick={handleMicClick} 
                            isListening={isListening} 
                            isProcessing={isProcessing}
                        />
                        <div className="h-16 mt-4">
                           {voices.length > 0 && <VoiceSelector voices={voices} selectedVoiceURI={selectedVoiceURI} onVoiceChange={setSelectedVoiceURI} disabled={isProcessing} />}
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
            <main className="w-full max-w-7xl mx-auto flex-grow flex lg:flex-row flex-col items-start justify-center gap-8 p-4">
                <div className="w-full lg:w-1/4 flex flex-col items-center justify-start gap-6">
                    <Avatar state={appState} emotion={emotion} />
                </div>
                 <div className="w-full lg:w-1/2 flex flex-col items-center gap-4">
                    <Tabs activeTab={inputMode} onTabChange={(mode) => { cancel(); setAppState(AppState.IDLE); setInputMode(mode); }} />
                    <div className="w-full flex-grow flex items-center justify-center p-4 bg-slate-800/50 rounded-lg min-h-[40rem]">
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