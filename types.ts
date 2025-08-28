export enum AppState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
}

export enum Emotion {
  NEUTRAL = 'NEUTRAL',
  JOYFUL = 'JOYFUL',
  CALM = 'CALM',
  ANGRY = 'ANGRY',
  SAD = 'SAD',
  SURPRISED = 'SURPRISED',
}

export interface InitialAnalysis {
  emotion: Emotion;
  languageCode: string;
}

export enum InputMode {
  VOICE = 'VOICE',
  TEXT = 'TEXT',
  PROFILE = 'PROFILE',
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  content: string;
  detectedEmotion?: Emotion;
}

export interface EmotionLogEntry {
  userMessage: string;
  emotion: Emotion;
}

export type UserProfile = Record<string, string>;
