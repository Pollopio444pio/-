import React, { useState } from 'react';
import { Mic, Paperclip, Send, Smile } from 'lucide-react';
import { STICKERS } from '../constants';
import StickerPicker from './StickerPicker';

interface MessageInputProps {
  onSendText: (text: string) => void;
  onSendSticker: (stickerId: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendText, onSendSticker }) => {
  const [text, setText] = useState('');
  const [showStickers, setShowStickers] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onSendText(text);
    setText('');
  };

  return (
    <div className="flex items-end gap-2 px-3 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33]">
      <div className="relative">
        <button
          onClick={() => setShowStickers(s => !s)}
          className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Stickers y emojis"
        >
          <Smile className="w-6 h-6" />
        </button>
        {showStickers && (
          <StickerPicker
            stickers={STICKERS}
            onPick={id => {
              onSendSticker(id);
              setShowStickers(false);
            }}
            onClose={() => setShowStickers(false)}
          />
        )}
      </div>

      <button className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition" title="Adjuntar">
        <Paperclip className="w-5 h-5" />
      </button>

      <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Escribe un mensaje"
          className="w-full bg-transparent outline-none text-sm text-[#111b21] dark:text-white placeholder:text-[#667781] dark:placeholder:text-[#8696a0]"
        />
      </div>

      {text.trim() ? (
        <button
          onClick={submit}
          className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition shrink-0"
          title="Enviar"
        >
          <Send className="w-5 h-5" />
        </button>
      ) : (
        <button className="p-2.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition shrink-0" title="Nota de voz">
          <Mic className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default MessageInput;
