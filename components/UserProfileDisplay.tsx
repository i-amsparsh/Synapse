import React from 'react';
import { UserProfile } from '../types';

interface UserProfileDisplayProps {
  profile: UserProfile;
  onClearProfile: () => void;
}

export const UserProfileDisplay: React.FC<UserProfileDisplayProps> = ({ profile, onClearProfile }) => {
    const profileEntries = Object.entries(profile);

    const formatKey = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div className="bg-slate-800 rounded-lg p-6 w-full max-w-2xl mx-auto my-4 text-white shadow-lg animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3 mb-4">
                <h2 className="text-2xl font-bold text-slate-100">AI Memory</h2>
                <button
                    onClick={onClearProfile}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={profileEntries.length === 0}
                    aria-label="Clear all remembered information"
                >
                    Clear Memory
                </button>
            </div>
            {profileEntries.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                    <p className="text-lg">The AI hasn't learned anything about you yet.</p>
                    <p className="text-sm">Share some details in your conversation to personalize your experience.</p>
                </div>
            ) : (
                <div className="space-y-3 chat-history pr-2 overflow-y-auto max-h-80">
                    {profileEntries.map(([key, value]) => (
                        <div key={key} className="bg-slate-700/50 p-3 rounded-md grid grid-cols-3 gap-4 items-center">
                            <strong className="text-slate-300 font-semibold col-span-1">{formatKey(key)}:</strong>
                            <span className="text-slate-200 col-span-2 break-words">{value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in {
    animation: fade-in 0.5s ease-out forwards;
  }
`;
document.head.append(style);
