import React, { useState } from 'react';

interface TextInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
}

const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M3 13.0001H9V11.0001H3V1.8451L22.292 12.0001L3 22.1551V13.0001Z"></path>
    </svg>
);

export const TextInput: React.FC<TextInputProps> = ({ onSendMessage, disabled }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex items-center gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message..."
        disabled={disabled}
        className="text-input flex-grow"
        aria-label="Chat message input"
      />
      <button type="submit" disabled={disabled} className="send-button" aria-label="Send message">
        <SendIcon className="w-6 h-6" />
      </button>
    </form>
  );
};
