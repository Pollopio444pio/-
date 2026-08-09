import React, { useMemo, useState } from 'react';
import { Moon, Search, Sun } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import { STICKERS } from '../constants';
import { formatClock } from '../utils/format';

interface SidebarProps {
  className?: string;
}

const lastMessagePreview = (chat: ReturnType<typeof useChat>['chats'][string]) => {
  const last = chat?.messages[chat.messages.length - 1];
  if (!last) return 'Di hola 👋';
  const prefix = last.sender === 'me' ? 'Tú: ' : '';
  if (last.kind === 'text') return `${prefix}${last.text}`;
  if (last.kind === 'sticker') {
    const sticker = STICKERS.find(s => s.id === last.stickerId);
    return `${prefix}${sticker?.emoji ?? '🌟'} Sticker`;
  }
  if (last.kind === 'call') {
    if (last.call?.missed) return last.call.declinedByMe ? 'Llamada rechazada' : 'Llamada perdida';
    const kindLabel = last.call?.kind === 'video' ? 'Videollamada' : 'Llamada de voz';
    return `${prefix}${kindLabel}`;
  }
  return '';
};

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { contacts, chats, activeChatId, selectChat, theme, toggleTheme } = useChat();
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => contacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase())),
    [contacts, query]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = chats[a.id]?.messages.at(-1)?.timestamp ?? 0;
      const tb = chats[b.id]?.messages.at(-1)?.timestamp ?? 0;
      return tb - ta;
    });
  }, [filtered, chats]);

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-[#111b21] ${className ?? ''}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐔</span>
          <h1 className="text-lg font-bold text-[#111b21] dark:text-white tracking-tight">PolloChat</h1>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Cambiar tema"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>

      <div className="px-3 py-2 bg-white dark:bg-[#111b21]">
        <div className="flex items-center gap-3 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5">
          <Search className="w-4 h-4 text-[#54656f] dark:text-[#aebac1]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar o empezar un chat"
            className="bg-transparent outline-none text-sm flex-1 py-1 text-[#111b21] dark:text-white placeholder:text-[#667781] dark:placeholder:text-[#8696a0]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sorted.map(contact => {
          const chat = chats[contact.id];
          const isActive = activeChatId === contact.id;
          const lastTs = chat?.messages.at(-1)?.timestamp;
          return (
            <button
              key={contact.id}
              onClick={() => selectChat(contact.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-black/5 dark:border-white/5 transition ${
                isActive ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
              }`}
            >
              <Avatar contact={contact} size={48} online={contact.online} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#111b21] dark:text-white truncate">{contact.name}</span>
                  {lastTs && (
                    <span className={`text-xs shrink-0 ml-2 ${chat.unread > 0 ? 'text-emerald-500 font-semibold' : 'text-[#667781] dark:text-[#8696a0]'}`}>
                      {formatClock(lastTs)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-sm text-[#667781] dark:text-[#8696a0] truncate">
                    {chat?.typing ? <span className="text-emerald-500">escribiendo…</span> : lastMessagePreview(chat)}
                  </span>
                  {chat?.unread > 0 && (
                    <span className="ml-2 shrink-0 bg-emerald-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
