import React, { useMemo } from 'react';

interface VoiceSelectorProps {
    voices: SpeechSynthesisVoice[];
    selectedVoiceURI: string | null;
    onVoiceChange: (uri: string) => void;
    disabled: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedVoiceURI, onVoiceChange, disabled }) => {
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
                                <option key={voice.voiceURI} value={voice.voiceURI}>
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
