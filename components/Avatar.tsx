
import React from 'react';
import { AppState, Emotion } from '../types';

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

export const Avatar: React.FC<AvatarProps> = ({ state, emotion }) => {
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
