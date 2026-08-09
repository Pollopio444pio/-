import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CONTACTS, INITIAL_CHATS, CALL_REACTIONS } from '../constants';
import { generateReply } from '../services/chatBotService';
import { ActiveCall, CallKind, CallReaction, ChatState, Contact, Message, Theme } from '../types';

const STORAGE_KEY = 'pollochat.chats.v1';
const THEME_KEY = 'pollochat.theme.v1';

const loadChats = (): Record<string, ChatState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupted storage
  }
  return INITIAL_CHATS;
};

const loadTheme = (): Theme => {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    // ignore
  }
  return 'light';
};

interface ChatContextValue {
  contacts: Contact[];
  chats: Record<string, ChatState>;
  activeChatId: string | null;
  selectChat: (contactId: string | null) => void;
  sendText: (contactId: string, text: string) => void;
  sendSticker: (contactId: string, stickerId: string) => void;
  theme: Theme;
  toggleTheme: () => void;
  activeCall: ActiveCall | null;
  startCall: (contactId: string, kind: CallKind) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  sendCallReaction: (emoji: string) => void;
  now: number;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [chats, setChats] = useState<Record<string, ChatState>>(loadChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [now, setNow] = useState(Date.now());

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const track = (t: ReturnType<typeof setTimeout>) => {
    timersRef.current.push(t);
    return t;
  };

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const activeCallRef = useRef(activeCall);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // storage full or unavailable, ignore
    }
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
  }, []);

  const selectChat = useCallback((contactId: string | null) => {
    setActiveChatId(contactId);
    if (!contactId) return;
    setChats(prev => {
      const chat = prev[contactId];
      if (!chat) return prev;
      return {
        ...prev,
        [contactId]: {
          ...chat,
          unread: 0,
          messages: chat.messages.map(m => (m.sender === 'them' ? { ...m, status: 'read' } : m)),
        },
      };
    });
  }, []);

  const appendMessage = useCallback((contactId: string, message: Message, isActive: boolean) => {
    setChats(prev => {
      const chat = prev[contactId] ?? { contactId, messages: [], unread: 0, typing: false };
      return {
        ...prev,
        [contactId]: {
          ...chat,
          messages: [...chat.messages, message],
          unread: isActive || message.sender === 'me' ? chat.unread : chat.unread + 1,
          typing: false,
        },
      };
    });
  }, []);

  const setTyping = useCallback((contactId: string, typing: boolean) => {
    setChats(prev => {
      const chat = prev[contactId];
      if (!chat) return prev;
      return { ...prev, [contactId]: { ...chat, typing } };
    });
  }, []);

  const markMineAsRead = useCallback((contactId: string) => {
    setChats(prev => {
      const chat = prev[contactId];
      if (!chat) return prev;
      return {
        ...prev,
        [contactId]: {
          ...chat,
          messages: chat.messages.map(m => (m.sender === 'me' ? { ...m, status: 'read' } : m)),
        },
      };
    });
  }, []);

  const bumpDelivered = useCallback((contactId: string, messageId: string) => {
    setChats(prev => {
      const chat = prev[contactId];
      if (!chat) return prev;
      return {
        ...prev,
        [contactId]: {
          ...chat,
          messages: chat.messages.map(m => (m.id === messageId ? { ...m, status: 'delivered' } : m)),
        },
      };
    });
  }, []);

  const triggerAutoReply = useCallback((contactId: string) => {
    track(setTimeout(() => setTyping(contactId, true), 700 + Math.random() * 500));
    track(setTimeout(async () => {
      const contact = CONTACTS.find(c => c.id === contactId);
      const chat = chatsRef.current[contactId];
      markMineAsRead(contactId);
      const history = chat ? chat.messages : [];
      const replyText = await generateReply(contact?.persona ?? 'un amigo cercano', history);
      const isActive = activeChatIdRef.current === contactId;
      appendMessage(contactId, {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sender: 'them',
        kind: 'text',
        text: replyText,
        timestamp: Date.now(),
        status: 'delivered',
      }, isActive);
    }, 1800 + Math.random() * 1400));
  }, [appendMessage, markMineAsRead, setTyping]);

  const sendText = useCallback((contactId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const message: Message = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'me',
      kind: 'text',
      text: trimmed,
      timestamp: Date.now(),
      status: 'sent',
    };
    appendMessage(contactId, message, true);
    track(setTimeout(() => bumpDelivered(contactId, message.id), 500));
    triggerAutoReply(contactId);
  }, [appendMessage, bumpDelivered, triggerAutoReply]);

  const sendSticker = useCallback((contactId: string, stickerId: string) => {
    const message: Message = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: 'me',
      kind: 'sticker',
      stickerId,
      timestamp: Date.now(),
      status: 'sent',
    };
    appendMessage(contactId, message, true);
    track(setTimeout(() => bumpDelivered(contactId, message.id), 500));
    triggerAutoReply(contactId);
  }, [appendMessage, bumpDelivered, triggerAutoReply]);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const logCallMessage = useCallback((contactId: string, kind: CallKind, durationSec: number, missed: boolean, declinedByMe: boolean) => {
    appendMessage(contactId, {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender: declinedByMe ? 'me' : 'them',
      kind: 'call',
      call: { kind, durationSec, missed, declinedByMe },
      timestamp: Date.now(),
      status: 'read',
    }, activeChatId === contactId);
  }, [appendMessage, activeChatId]);

  const startCall = useCallback((contactId: string, kind: CallKind) => {
    setActiveCall({
      contactId,
      kind,
      status: 'outgoing',
      startedAt: null,
      muted: false,
      cameraOn: kind === 'video',
      speakerOn: true,
      reactions: [],
    });

    const contact = CONTACTS.find(c => c.id === contactId);
    const willAnswer = Math.random() < (contact?.reliability ?? 0.7);

    track(setTimeout(() => {
      const prev = activeCallRef.current;
      if (!prev || prev.contactId !== contactId || prev.status !== 'outgoing') return;
      if (!willAnswer) {
        logCallMessage(contactId, kind, 0, true, false);
        setActiveCall({ ...prev, status: 'ended' });
        track(setTimeout(() => {
          if (activeCallRef.current?.contactId === contactId) setActiveCall(null);
        }, 1600));
      } else {
        setActiveCall({ ...prev, status: 'connected', startedAt: Date.now() });
      }
    }, 2200 + Math.random() * 1400));
  }, [logCallMessage]);

  const acceptCall = useCallback(() => {
    setActiveCall(prev => (prev ? { ...prev, status: 'connected', startedAt: Date.now() } : prev));
  }, []);

  const declineCall = useCallback(() => {
    const prev = activeCallRef.current;
    if (!prev) return;
    logCallMessage(prev.contactId, prev.kind, 0, true, prev.status === 'outgoing');
    setActiveCall({ ...prev, status: 'ended' });
    track(setTimeout(() => {
      if (activeCallRef.current?.contactId === prev.contactId) setActiveCall(null);
    }, 1600));
  }, [logCallMessage]);

  const endCall = useCallback(() => {
    const prev = activeCallRef.current;
    if (!prev) return;
    if (prev.status === 'connected' && prev.startedAt) {
      const durationSec = Math.max(1, Math.round((Date.now() - prev.startedAt) / 1000));
      logCallMessage(prev.contactId, prev.kind, durationSec, false, false);
    }
    setActiveCall(null);
  }, [logCallMessage]);

  const toggleMute = useCallback(() => {
    setActiveCall(prev => (prev ? { ...prev, muted: !prev.muted } : prev));
  }, []);

  const toggleCamera = useCallback(() => {
    setActiveCall(prev => (prev ? { ...prev, cameraOn: !prev.cameraOn } : prev));
  }, []);

  const pushReaction = useCallback((emoji: string, from: 'me' | 'them') => {
    const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = 2200 + Math.random() * 1200;
    const reaction: CallReaction = {
      id,
      emoji,
      left: 8 + Math.random() * 78,
      drift: -30 + Math.random() * 60,
      duration,
      from,
    };
    setActiveCall(prev => (prev ? { ...prev, reactions: [...prev.reactions, reaction] } : prev));
    track(setTimeout(() => {
      setActiveCall(prev => (prev ? { ...prev, reactions: prev.reactions.filter(r => r.id !== id) } : prev));
    }, duration + 100));
  }, []);

  const sendCallReaction = useCallback((emoji: string) => {
    pushReaction(emoji, 'me');
  }, [pushReaction]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'connected') return;
    const scheduleNext = () => {
      const delay = 4000 + Math.random() * 6000;
      return track(setTimeout(() => {
        if (Math.random() < 0.6) {
          const random = CALL_REACTIONS[Math.floor(Math.random() * CALL_REACTIONS.length)];
          pushReaction(random.emoji, 'them');
        }
        timer = scheduleNext();
      }, delay));
    };
    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [activeCall?.status, activeCall?.contactId, pushReaction]);

  useEffect(() => {
    const guard = { fired: false };
    const t = setTimeout(() => {
      if (guard.fired) return;
      guard.fired = true;
      setActiveCall(prev => {
        if (prev) return prev;
        const candidates = CONTACTS.filter(c => c.id !== 'polli');
        const contact = candidates[Math.floor(Math.random() * candidates.length)];
        const kind: CallKind = Math.random() < 0.5 ? 'video' : 'voice';
        return {
          contactId: contact.id,
          kind,
          status: 'incoming',
          startedAt: null,
          muted: false,
          cameraOn: kind === 'video',
          speakerOn: true,
          reactions: [],
        };
      });
    }, 14000 + Math.random() * 6000);
    return () => {
      guard.fired = true;
      clearTimeout(t);
    };
  }, []);

  const value = useMemo<ChatContextValue>(() => ({
    contacts: CONTACTS,
    chats,
    activeChatId,
    selectChat,
    sendText,
    sendSticker,
    theme,
    toggleTheme,
    activeCall,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    sendCallReaction,
    now,
  }), [chats, activeChatId, selectChat, sendText, sendSticker, theme, toggleTheme, activeCall, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera, sendCallReaction, now]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
};
