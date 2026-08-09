import { Contact, ChatState, StickerItem, Message } from './types';

export const STICKERS: StickerItem[] = [
  { id: 's-heart', emoji: '❤️', label: 'Corazón' },
  { id: 's-laugh', emoji: '😂', label: 'Risa' },
  { id: 's-wow', emoji: '😮', label: 'Wow' },
  { id: 's-sad', emoji: '😢', label: 'Triste' },
  { id: 's-fire', emoji: '🔥', label: 'Fuego' },
  { id: 's-clap', emoji: '👏', label: 'Aplausos' },
  { id: 's-party', emoji: '🎉', label: 'Fiesta' },
  { id: 's-thumbsup', emoji: '👍', label: 'Genial' },
  { id: 's-love-eyes', emoji: '😍', label: 'Enamorado' },
  { id: 's-cool', emoji: '😎', label: 'Cool' },
  { id: 's-cry-laugh', emoji: '🤣', label: 'Muerto de risa' },
  { id: 's-kiss', emoji: '😘', label: 'Beso' },
  { id: 's-pray', emoji: '🙏', label: 'Gracias' },
  { id: 's-100', emoji: '💯', label: 'Cien' },
  { id: 's-chicken', emoji: '🐔', label: 'Pollo' },
  { id: 's-egg', emoji: '🐣', label: 'Pollito' },
  { id: 's-drumstick', emoji: '🍗', label: 'Pierna' },
  { id: 's-eyes', emoji: '👀', label: 'Ojos' },
  { id: 's-mind-blown', emoji: '🤯', label: 'Explota' },
  { id: 's-cake', emoji: '🎂', label: 'Pastel' },
  { id: 's-star', emoji: '🌟', label: 'Estrella' },
  { id: 's-rainbow', emoji: '🌈', label: 'Arcoíris' },
  { id: 's-coffee', emoji: '☕', label: 'Café' },
  { id: 's-sleepy', emoji: '😴', label: 'Sueño' },
];

export const CALL_REACTIONS: StickerItem[] = [
  { id: 's-heart', emoji: '❤️', label: 'Corazón' },
  { id: 's-laugh', emoji: '😂', label: 'Risa' },
  { id: 's-wow', emoji: '😮', label: 'Wow' },
  { id: 's-clap', emoji: '👏', label: 'Aplausos' },
  { id: 's-fire', emoji: '🔥', label: 'Fuego' },
  { id: 's-party', emoji: '🎉', label: 'Fiesta' },
  { id: 's-chicken', emoji: '🐔', label: 'Pollo' },
  { id: 's-100', emoji: '💯', label: 'Cien' },
];

const now = Date.now();
const minutes = (n: number) => n * 60 * 1000;
const hours = (n: number) => n * 60 * minutes(1);

export const CONTACTS: Contact[] = [
  {
    id: 'valentina',
    name: 'Valentina Ríos',
    avatarColor: '#f97316',
    persona: 'Valentina, la mejor amiga del usuario: alegre, cariñosa, usa muchos emojis y jerga juvenil en español',
    online: true,
    lastSeen: now,
    reliability: 0.95,
  },
  {
    id: 'carlos',
    name: 'Carlos Mendoza',
    avatarColor: '#0ea5e9',
    persona: 'Carlos, un colega de trabajo del usuario: educado, breve, algo formal pero amigable',
    online: false,
    lastSeen: now - hours(2),
    reliability: 0.6,
  },
  {
    id: 'mama',
    name: 'Mamá ❤️',
    avatarColor: '#ec4899',
    persona: 'la mamá del usuario: muy cariñosa, pregunta si ya comió y si se abrigó, usa "hijo/hija" y corazones',
    online: true,
    lastSeen: now,
    reliability: 0.85,
  },
  {
    id: 'polli',
    name: 'Polli 🐔 PolloChat',
    avatarEmoji: '🐔',
    avatarColor: '#22c55e',
    persona: 'Polli, la mascota asistente oficial de PolloChat: un pollito súper simpático, gracioso y servicial que siempre contesta',
    online: true,
    lastSeen: now,
    reliability: 1,
  },
];

let msgId = 1;
const nextId = () => `m-${msgId++}`;

const textMsg = (sender: 'me' | 'them', text: string, minutesAgo: number, status: Message['status'] = 'read'): Message => ({
  id: nextId(),
  sender,
  kind: 'text',
  text,
  timestamp: now - minutes(minutesAgo),
  status,
});

const stickerMsg = (sender: 'me' | 'them', stickerId: string, minutesAgo: number): Message => ({
  id: nextId(),
  sender,
  kind: 'sticker',
  stickerId,
  timestamp: now - minutes(minutesAgo),
  status: 'read',
});

export const INITIAL_CHATS: Record<string, ChatState> = {
  valentina: {
    contactId: 'valentina',
    unread: 2,
    typing: false,
    messages: [
      textMsg('them', '¡Hola! ¿Ya viste lo que pasó hoy? 😱', 40),
      textMsg('me', 'Jajaja no, cuéntame ya', 38),
      textMsg('them', 'Nada, te estoy molestando 😂 pero bueno... ¿nos vemos el finde?', 37),
      stickerMsg('them', 's-heart', 36),
      textMsg('me', 'Obvio que sí, te aviso la hora', 20),
      textMsg('them', 'Dale, aquí espero 🐔🔥', 5, 'delivered'),
    ],
  },
  carlos: {
    contactId: 'carlos',
    unread: 0,
    typing: false,
    messages: [
      textMsg('them', 'Buenas, ¿pudiste revisar el documento que envié?', 180),
      textMsg('me', 'Sí, ya casi termino, te lo mando en un rato', 175),
      textMsg('them', 'Perfecto, gracias por el apoyo', 170),
    ],
  },
  mama: {
    contactId: 'mama',
    unread: 1,
    typing: false,
    messages: [
      textMsg('them', 'Hijo, ¿ya comiste? ❤️', 90),
      textMsg('me', 'Sí mamá, tranquila jaja', 88),
      textMsg('them', 'Abrígate que va a hacer frío 🧣', 86),
      stickerMsg('them', 's-love-eyes', 10),
    ],
  },
  polli: {
    contactId: 'polli',
    unread: 0,
    typing: false,
    messages: [
      textMsg('them', '¡Pío pío! 🐔 Bienvenido a PolloChat. Soy Polli, tu asistente. Escríbeme o llámame cuando quieras, siempre contesto 🍗✨', 2),
    ],
  },
};

export const FALLBACK_REPLIES = [
  'Jajaja sí, totalmente 😂',
  'Uy no sabía eso 👀',
  '¡Qué bueno! Me alegra mucho ❤️',
  'Ando ocupado ahora, te escribo en un rato 🙏',
  'jajaja eres el/la mejor 🔥',
  'Dale, hablamos luego 👍',
  'Justo estaba pensando en eso 😮',
  'Cuéntame más 👀',
  '¡Vale! Nos vemos pronto 🎉',
  'Gracias por avisarme 🙌',
];
