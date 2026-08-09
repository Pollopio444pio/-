import React from 'react';
import { StickerItem } from '../types';

interface StickerPickerProps {
  stickers: StickerItem[];
  onPick: (stickerId: string) => void;
  onClose: () => void;
}

const StickerPicker: React.FC<StickerPickerProps> = ({ stickers, onPick, onClose }) => {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute bottom-full left-0 mb-2 z-40 w-72 max-h-64 overflow-y-auto bg-white dark:bg-[#233138] rounded-xl shadow-2xl border border-black/5 dark:border-white/10 p-3 animate-pop-in">
        <p className="text-xs font-semibold text-[#54656f] dark:text-[#aebac1] mb-2 px-1">Stickers</p>
        <div className="grid grid-cols-6 gap-1">
          {stickers.map(sticker => (
            <button
              key={sticker.id}
              onClick={() => onPick(sticker.id)}
              title={sticker.label}
              className="text-3xl rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-125 transition-transform"
            >
              {sticker.emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default StickerPicker;
