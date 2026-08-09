import React from 'react';
import { Check, CheckCheck, Phone, PhoneMissed, Video } from 'lucide-react';
import { Message } from '../types';
import { STICKERS } from '../constants';
import { formatClock, formatDuration } from '../utils/format';

interface MessageBubbleProps {
  message: Message;
}

const Ticks: React.FC<{ status: Message['status'] }> = ({ status }) => {
  if (status === 'sent') return <Check className="w-4 h-4 text-[#667781] dark:text-[#8696a0]" />;
  const color = status === 'read' ? 'text-sky-500' : 'text-[#667781] dark:text-[#8696a0]';
  return <CheckCheck className={`w-4 h-4 ${color}`} />;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isMe = message.sender === 'me';

  if (message.kind === 'call') {
    const { call } = message;
    const missed = call?.missed;
    const Icon = call?.kind === 'video' ? Video : Phone;
    return (
      <div className="flex justify-center my-2 animate-message-in">
        <div className="flex items-center gap-2 bg-white/90 dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] text-xs px-3 py-1.5 rounded-full shadow-sm">
          {missed ? <PhoneMissed className="w-3.5 h-3.5 text-red-500" /> : <Icon className="w-3.5 h-3.5 text-emerald-500" />}
          <span>
            {missed
              ? call?.declinedByMe
                ? 'Llamada rechazada'
                : `${call?.kind === 'video' ? 'Videollamada' : 'Llamada'} perdida`
              : `${call?.kind === 'video' ? 'Videollamada' : 'Llamada de voz'} · ${formatDuration(call?.durationSec ?? 0)}`}
          </span>
          <span className="text-[10px] opacity-70">{formatClock(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  if (message.kind === 'sticker') {
    const sticker = STICKERS.find(s => s.id === message.stickerId);
    return (
      <div className={`flex mb-1.5 animate-message-in ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="flex flex-col items-end">
          <span className="text-6xl drop-shadow-md leading-none px-1">{sticker?.emoji ?? '🌟'}</span>
          <span className="text-[10px] text-[#667781] dark:text-[#8696a0] mt-0.5 pr-1">{formatClock(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex mb-1.5 animate-message-in ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[75%] px-2.5 py-1.5 rounded-lg shadow-sm text-sm leading-relaxed break-words ${
          isMe
            ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-none'
            : 'bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-none'
        }`}
      >
        <span className="whitespace-pre-wrap">{message.text}</span>
        <span className="inline-flex items-center gap-1 float-right ml-2 mt-1 translate-y-1.5">
          <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{formatClock(message.timestamp)}</span>
          {isMe && <Ticks status={message.status} />}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
