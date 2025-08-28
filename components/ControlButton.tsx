import React from 'react';

interface ControlButtonProps {
    onClick: () => void;
    isListening: boolean;
    isProcessing: boolean;
}

const MicrophoneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.9999 14.9497C10.1818 14.9497 8.70996 13.4778 8.70996 11.6597V6.33966C8.70996 4.52159 10.1818 3.04968 11.9999 3.04968C13.818 3.04968 15.29 4.52159 15.29 6.33966V11.6597C15.29 13.4778 13.818 14.9497 11.9999 14.9497ZM11.9999 17.0997C14.7509 17.0997 17.0179 14.8327 17.0179 12.0817H19.1679C19.1679 15.3187 16.6579 17.9817 13.7179 18.4217V20.9997H10.2819V18.4217C7.34193 17.9817 4.83191 15.3187 4.83191 12.0817H6.98192C6.98192 14.8327 9.24894 17.0997 11.9999 17.0997Z"></path>
    </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M6 5H18C18.5523 5 19 5.44772 19 6V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6C5 5.44772 5.44772 5 6 5Z"></path>
    </svg>
);


export const ControlButton: React.FC<ControlButtonProps> = ({ onClick, isListening, isProcessing }) => {
    const baseClasses = "w-24 h-24 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg";
    
    let activeClasses = "";
    let icon = <MicrophoneIcon className="text-white w-10 h-10" />;
    let label = 'Start listening';

    if (isProcessing && !isListening) {
        // AI is thinking or speaking
        activeClasses = "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400";
        icon = <StopIcon className="text-white w-10 h-10" />;
        label = 'Stop processing';
    } else if (isListening) {
        // App is actively listening for user input
        activeClasses = "bg-red-500 hover:bg-red-600 focus:ring-red-400 animate-pulse-glow";
        icon = <MicrophoneIcon className="text-white w-10 h-10" />;
        label = 'Stop listening';
    } else {
        // Default idle state
        activeClasses = "bg-green-500 hover:bg-green-600 focus:ring-green-400";
        label = 'Start listening';
    }

    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${activeClasses}`}
            aria-label={label}
        >
            {icon}
        </button>
    );
};