
import { useState, useEffect, useRef, useCallback } from 'react';

// FIX: Add type definitions for the Web Speech API, which are not standard in TypeScript's DOM library.
// This resolves errors about `SpeechRecognition` not existing on the `window` object.
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

// Browser compatibility
// FIX: Rename `SpeechRecognition` to `SpeechRecognitionAPI` to resolve a name collision.
// The original name conflicted with the `SpeechRecognition` interface type defined above,
// causing an error when using it as a type in `useRef`.
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

interface UseSpeechRecognitionProps {
    onTurnEnd?: (transcript: string) => void;
}

export const useSpeechRecognition = ({ onTurnEnd }: UseSpeechRecognitionProps = {}) => {
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
