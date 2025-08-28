import React from 'react';
import { Emotion } from '../types';

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

export const EmotionIndicator: React.FC<EmotionIndicatorProps> = ({ emotion, className = 'w-5 h-5' }) => {
    const { icon, color, label } = emotionMap[emotion] || emotionMap[Emotion.NEUTRAL];

    return (
        <div className={`${className} ${color}`} title={`Detected Emotion: ${label}`} aria-label={`Detected Emotion: ${label}`}>
            {icon}
        </div>
    );
};
