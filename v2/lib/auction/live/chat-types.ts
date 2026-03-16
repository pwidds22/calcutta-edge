export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
}

export const CHAT_MAX_LENGTH = 500;
export const CHAT_RATE_LIMIT_MS = 2000;
export const CHAT_MAX_MESSAGES = 200;
