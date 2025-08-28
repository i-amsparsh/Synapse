import React from 'react';
import { InputMode } from '../types';

interface TabsProps {
  activeTab: InputMode;
  onTabChange: (tab: InputMode) => void;
}

export const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const getTabClasses = (tab: InputMode) => {
    const base = "px-4 py-2 text-lg font-medium transition-colors duration-200 focus:outline-none rounded-t-md";
    const active = "text-sky-300 border-b-2 border-sky-300";
    const inactive = "text-slate-400 hover:text-slate-200";
    return `${base} ${activeTab === tab ? active : inactive}`;
  };

  return (
    <div className="flex justify-center gap-8 border-b border-slate-700 w-full max-w-md">
      <button onClick={() => onTabChange(InputMode.VOICE)} className={getTabClasses(InputMode.VOICE)}>
        Voice
      </button>
      <button onClick={() => onTabChange(InputMode.TEXT)} className={getTabClasses(InputMode.TEXT)}>
        Text
      </button>
      <button onClick={() => onTabChange(InputMode.PROFILE)} className={getTabClasses(InputMode.PROFILE)}>
        Profile
      </button>
    </div>
  );
};
