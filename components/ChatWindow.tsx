import React, { useEffect, useRef } from 'react';
import { ArrowLeft, MoreVertical, Phone, Video } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { formatLastSeen } from '../utils/format';

interface ChatWindowProps {
  onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ onBack }) => {
  const { contacts, chats, activeChatId, sendText, sendSticker, startCall, now } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  const contact = contacts.find(c => c.id === activeChatId);
  const chat = activeChatId ? chats[activeChatId] : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages.length, chat?.typing]);

  if (!contact) {
    return (
      <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#f0f2f5] dark:bg-[#222e35] text-center px-8">
        <span className="text-7xl mb-4">🐔💬</span>
        <h2 className="text-2xl font-light text-[#41525d] dark:text-[#e9edef]">PolloChat</h2>
        <p className="text-sm text-[#667781] dark:text-[#8696a0] mt-2 max-w-sm">
          Selecciona un chat para empezar a enviar mensajes y stickers, o hacer una llamada.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] chat-bg">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] shadow-sm z-10">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-1 text-[#54656f] dark:text-[#aebac1]">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Avatar contact={contact} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[#111b21] dark:text-white truncate">{contact.name}</p>
          <p className="text-xs text-[#667781] dark:text-[#8696a0]">
            {chat?.typing ? <span className="text-emerald-500">escribiendo…</span> : contact.online ? 'en línea' : formatLastSeen(contact.lastSeen, now)}
          </p>
        </div>
        <button
          onClick={() => startCall(contact.id, 'video')}
          className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Videollamada"
        >
          <Video className="w-5 h-5" />
        </button>
        <button
          onClick={() => startCall(contact.id, 'voice')}
          className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Llamada de voz"
        >
          <Phone className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition" title="Más opciones">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 md:px-10 py-4">
        {chat?.messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {chat?.typing && (
          <div className="flex justify-start mb-1.5">
            <div className="bg-white dark:bg-[#202c33] rounded-lg rounded-tl-none px-3 py-2.5 flex gap-1 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#8696a0] animate-typing-dot [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-[#8696a0] animate-typing-dot [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-[#8696a0] animate-typing-dot [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSendText={t => sendText(contact.id, t)}
        onSendSticker={id => sendSticker(contact.id, id)}
      />
    </div>
  );
};

export default ChatWindow;
