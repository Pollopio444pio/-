export const formatClock = (ts: number): string =>
  new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

export const formatDuration = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const formatLastSeen = (ts: number, now: number): string => {
  const diffMin = Math.floor((now - ts) / 60000);
  if (diffMin < 1) return 'en línea';
  if (diffMin < 60) return `últ. vez hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `últ. vez hace ${diffHours} h`;
  return `últ. vez hace ${Math.floor(diffHours / 24)} d`;
};
