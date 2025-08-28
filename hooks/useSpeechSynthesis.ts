import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeakOptions {
    lang?: string;
    voiceURI?: string | null;
    onEnd?: () => void;
}

export const useSpeechSynthesis = () => {
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