import React from 'react';
import { Contact } from '../types';

interface AvatarProps {
  contact: Pick<Contact, 'name' | 'avatarUrl' | 'avatarEmoji' | 'avatarColor'>;
  size?: number;
  online?: boolean;
  ring?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ contact, size = 48, online, ring }) => {
  const style: React.CSSProperties = { width: size, height: size };

  return (
    <div className="relative shrink-0" style={style}>
      <div
        className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center select-none ${
          ring ? 'ring-4 ring-emerald-400/40' : ''
        }`}
        style={{ backgroundColor: contact.avatarColor }}
      >
        {contact.avatarUrl ? (
          <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <span style={{ fontSize: size * 0.55 }}>{contact.avatarEmoji ?? contact.name.charAt(0)}</span>
        )}
      </div>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111b21]"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
};

export default Avatar;
