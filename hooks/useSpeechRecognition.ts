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

export const useSpeechRecognition = () => {
    const [text, setText] = useState('');
    const [interimText, setInterimText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // This is called by the UI to stop listening, e.g., if the user clicks the button again.
    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            // onend will be triggered, which will set isListening to false.
        }
    }, []);

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

        setText('');
        setInterimText('');
        setError(null); // Reset error on a new attempt
        setIsListening(true);

        const recognition = new SpeechRecognitionAPI();
        recognitionRef.current = recognition;

        // Configuration for single-utterance recognition for better reliability
        recognition.continuous = false;
        recognition.interimResults = true;
        // By not setting recognition.lang, the browser will use its default language, enabling multi-language support.

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            if (finalTranscript.trim()) {
                setText(finalTranscript.trim());
            }
            setInterimText(interimTranscript);
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
        };
        
        try {
            recognition.start();
        } catch (e) {
            console.error("Could not start recognition service:", e);
            setIsListening(false);
            recognitionRef.current = null;
        }

    }, [isListening]);

    return { text, interimText, isListening, error, startListening, stopListening, hasRecognitionSupport: !!SpeechRecognitionAPI, clearError };
};