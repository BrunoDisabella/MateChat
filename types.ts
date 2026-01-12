
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
  scheduledTime?: number | null; // Unix timestamp in seconds or null
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

export interface ScheduledMessage {
  id: string;
  chat_id: string;
  body: string;
  scheduled_time: string; // ISO String
  is_active: boolean;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export interface ScheduledStatus {
  id: string;
  type: 'text' | 'image' | 'video';
  content?: string; // Texto para estados de texto o caption para media
  media_data?: string; // Base64
  media_mimetype?: string;
  background_color?: string; // Hex color para estados de texto
  font_type?: number; // Para estados de texto
  scheduled_time: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
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
