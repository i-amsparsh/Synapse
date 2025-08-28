import React, { useState } from 'react';

interface ApiKeyModalProps {
    onSubmit: (apiKey: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSubmit }) => {
    const [apiKey, setApiKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onSubmit(apiKey.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-8 max-w-md w-full m-4">
                <form onSubmit={handleSubmit}>
                    <h2 className="text-2xl font-bold text-slate-100 mb-4">Enter API Key</h2>
                    <p className="text-slate-400 mb-6">
                        To use Synapse AI, please provide your Google Gemini API key. Your key will only be stored in your browser for this session.
                    </p>
                    <div className="mb-6">
                        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">
                            Gemini API Key
                        </label>
                        <input
                            id="apiKey"
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="text-input w-full"
                            placeholder="Enter your API key here"
                            required
                            autoFocus
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-400"
                    >
                        Save and Continue
                    </button>
                </form>
            </div>
        </div>
    );
};
