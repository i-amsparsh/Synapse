import React from 'react';
import { AppState, Emotion } from '../types';
import { EmotionIndicator } from './EmotionIndicator';

interface StatusDisplayProps {
    state: AppState;
    userText: string;
    interimText: string;
    aiText: string;
    detectedEmotion: Emotion | null;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ state, userText, interimText, aiText, detectedEmotion }) => {
    
    const getStatusMessage = () => {
        switch (state) {
            case AppState.LISTENING: return "Listening...";
            case AppState.THINKING: return "Thinking...";
            case AppState.SPEAKING: return "Responding...";
            case AppState.ERROR: return "Something went wrong. Please try again.";
            case AppState.IDLE: return "Click the microphone to start";
            default: return "";
        }
    };

    const userTranscript = userText || interimText;
    const showUserTranscript = (state === AppState.LISTENING || state === AppState.THINKING || (state === AppState.SPEAKING && userText)) && userTranscript;

    return (
        <div className="text-center h-40 flex flex-col justify-between p-4 text-slate-300 w-full">
            <div className="h-1/3">
                <p className="text-xl font-medium text-slate-100 min-h-[2rem] transition-opacity duration-300">
                    {getStatusMessage()}
                </p>
            </div>
            
            <div className="h-2/3 flex flex-col justify-center items-center min-h-[5rem] overflow-y-auto gap-2">
                 {showUserTranscript &&
                    <p className="text-lg italic transition-opacity duration-300">You: "{userTranscript}"</p>
                 }
                 { state === AppState.SPEAKING && aiText &&
                    <div className="flex items-center justify-center gap-2 transition-opacity duration-300">
                        {detectedEmotion && <EmotionIndicator emotion={detectedEmotion} />}
                        <p className="text-lg font-semibold text-cyan-300">Synapse: "{aiText}"</p>
                    </div>
                 }
                 { state === AppState.ERROR && aiText &&
                    <p className="text-lg font-semibold text-red-400 transition-opacity duration-300">Synapse: "{aiText}"</p>
                 }
            </div>
        </div>
    );
};