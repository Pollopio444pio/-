export type MessageStatus = 'sent' | 'delivered' | 'read';
export type MessageKind = 'text' | 'sticker' | 'call';
export type CallKind = 'voice' | 'video';
export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';
export type Sender = 'me' | 'them';

export interface StickerItem {
  id: string;
  emoji: string;
  label: string;
}

export interface CallInfo {
  kind: CallKind;
  durationSec: number;
  missed?: boolean;
  declinedByMe?: boolean;
}

export interface Message {
  id: string;
  sender: Sender;
  kind: MessageKind;
  text?: string;
  stickerId?: string;
  call?: CallInfo;
  timestamp: number;
  status: MessageStatus;
}

export interface Contact {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  avatarColor: string;
  persona: string;
  online: boolean;
  lastSeen: number;
  reliability: number; // 0-1 probability the contact answers a call
}

export interface ChatState {
  contactId: string;
  messages: Message[];
  unread: number;
  typing: boolean;
}

export interface CallReaction {
  id: string;
  emoji: string;
  left: number;
  drift: number;
  duration: number;
  from: Sender;
}

export interface ActiveCall {
  contactId: string;
  kind: CallKind;
  status: CallStatus;
  startedAt: number | null;
  muted: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  reactions: CallReaction[];
}

export type Theme = 'light' | 'dark';
