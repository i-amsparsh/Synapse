import React from 'react';
import { Emotion, EmotionLogEntry } from '../types';
import { EmotionIndicator } from './EmotionIndicator';

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

export const EmotionLog: React.FC<EmotionLogProps> = ({ entries }) => {
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

// Add a simple fade-in animation for new log entries
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
