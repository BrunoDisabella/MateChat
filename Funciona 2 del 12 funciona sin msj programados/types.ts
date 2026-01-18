export interface User {
  id: string;
  email?: string;
}

export interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  hasMedia: boolean;
  media?: {
    mimetype: string;
    data: string; // Base64
    filename?: string;
  };
  isVoiceMessage?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: Message | null;
  profilePicUrl?: string | null;
  unreadCount?: number;
}

export interface SendMessagePayload {
  to: string;
  text?: string;
  audioBase64?: string;
  audioMime?: string;
  isVoiceMessage?: boolean;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  QR_READY = 'QR_READY',
  CONNECTED = 'CONNECTED',
}

export interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
}

export interface Webhook {
  url: string;
  onMessageReceived: boolean;
  onMessageSent: boolean;
}

export interface ApiConfig {
  enabled: boolean;
  apiKey: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export type ChatLabels = Record<string, string[]>; // chatId -> labelId[]

export type LogLevel = 'log' | 'warn' | 'error' | 'info';

export interface LogEntry {
  level: LogLevel;
  message: any[];
  timestamp: Date;
  source: string;
}

export interface Session {
  access_token: string;
  user: User;
}