import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { EmotionIndicator } from './EmotionIndicator';

interface ChatHistoryProps {
  messages: ChatMessage[];
  isThinking: boolean;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, isThinking }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="chat-history w-full h-80 overflow-y-auto p-2 flex flex-col gap-4">
      {messages.map((msg, index) => (
        <div key={index} className={`chat-bubble-wrapper ${msg.sender === 'user' ? 'self-end' : 'self-start'}`}>
          <div className={`chat-bubble ${msg.sender === 'user' ? 'user' : 'ai'}`}>
            {msg.sender === 'ai' && msg.detectedEmotion && (
              <div className="flex items-center gap-2 mb-2 border-b border-slate-600 pb-2">
                <EmotionIndicator emotion={msg.detectedEmotion} className="w-4 h-4" />
                <span className="text-xs text-slate-400 font-medium">Detected Emotion</span>
              </div>
            )}
            {msg.content}
          </div>
        </div>
      ))}
      {isThinking && (
        <div className="chat-bubble-wrapper self-start">
            <div className="chat-bubble ai">
                <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
};