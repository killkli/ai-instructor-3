/**
 * 語音管理器類型定義
 */

export interface VoiceInputState {
  isActive: boolean;
  language: string | null;
  isPracticeMode: boolean;
}

export interface SpeechManagerState extends VoiceInputState {
  isInitialized: boolean;
  isSupported: boolean;
  ttsSupported: boolean;
}

export interface VoiceSupport {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  error?: string;
}

declare class SpeechManager {
  constructor(app: any);
  init(): Promise<void>;
  handleVoiceInput(language: string): Promise<void>;
  stopVoiceInput(): void;
  handleSpeechPlayback(button: HTMLElement, text: string): Promise<void>;
  handleSpeechPractice(button: HTMLElement, text: string): void;
  checkVoiceSupport(): VoiceSupport | null;
  getVoiceInputState(): VoiceInputState;
  getState(): SpeechManagerState;
  reset(): void;
  addSpeechButtonsToMessage(messageWrapper: HTMLElement): void;
}

export default SpeechManager; 