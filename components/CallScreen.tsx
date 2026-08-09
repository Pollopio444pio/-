import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Smile, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import Avatar from './Avatar';
import { CALL_REACTIONS } from '../constants';
import { formatDuration } from '../utils/format';

const CallScreen: React.FC = () => {
  const { contacts, activeCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera, sendCallReaction, now } = useChat();
  const [showReactions, setShowReactions] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const contact = contacts.find(c => c.id === activeCall?.contactId);
  const kind = activeCall?.kind;
  const status = activeCall?.status;

  useEffect(() => {
    if (!activeCall || kind !== 'video' || status === 'ended') return;
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError(true));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.contactId, kind]);

  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach(t => {
      t.enabled = !!activeCall?.cameraOn;
    });
  }, [activeCall?.cameraOn]);

  if (!activeCall || !contact) return null;

  const elapsed = activeCall.startedAt ? Math.max(0, Math.floor((now - activeCall.startedAt) / 1000)) : 0;
  const showSelfVideo = kind === 'video' && activeCall.cameraOn && !cameraError;
  const isRinging = status === 'outgoing' || status === 'incoming';

  const statusLabel =
    status === 'outgoing' ? 'Llamando…' :
    status === 'incoming' ? `${kind === 'video' ? 'Videollamada' : 'Llamada'} entrante` :
    status === 'connected' ? formatDuration(elapsed) :
    'Finalizada';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#0b141a] via-[#111b21] to-[#0b141a] text-white overflow-hidden">
      {kind === 'video' && status === 'connected' && (
        <div className="absolute inset-0">
          <div
            className="w-full h-full flex items-center justify-center animate-remote-pulse"
            style={{ background: `radial-gradient(circle at 50% 40%, ${contact.avatarColor}55, #0b141a 75%)` }}
          >
            <Avatar contact={contact} size={160} />
          </div>
        </div>
      )}

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pointer-events-none">
        {!(kind === 'video' && status === 'connected') && (
          <>
            <div className={`relative ${isRinging ? 'animate-ring-pulse' : ''}`}>
              <Avatar contact={contact} size={140} />
            </div>
            <h2 className="mt-6 text-2xl font-semibold">{contact.name}</h2>
          </>
        )}
        {kind === 'video' && status === 'connected' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
            <h2 className="text-lg font-semibold drop-shadow">{contact.name}</h2>
          </div>
        )}
        <p className="mt-2 text-white/70 text-sm tracking-wide">{statusLabel}</p>
      </div>

      {/* Floating call reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {activeCall.reactions.map(r => (
          <span
            key={r.id}
            className="absolute bottom-24 text-4xl"
            style={{
              left: `${r.left}%`,
              animation: `float-up ${r.duration}ms ease-out forwards`,
              ['--drift' as unknown as string]: `${r.drift}px`,
            }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Self video PiP */}
      {kind === 'video' && status !== 'ended' && (
        <div className="absolute top-6 right-4 w-24 h-36 md:w-32 md:h-44 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#202c33] z-10">
          {showSelfVideo ? (
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#2a3942]">
              <VideoOff className="w-6 h-6 text-white/50" />
            </div>
          )}
        </div>
      )}

      {showReactions && status === 'connected' && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowReactions(false)} />
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-40 flex gap-2 bg-black/60 backdrop-blur px-3 py-2 rounded-full animate-pop-in">
            {CALL_REACTIONS.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  sendCallReaction(r.emoji);
                  setShowReactions(false);
                }}
                className="text-2xl hover:scale-125 transition-transform"
                title={r.label}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="relative z-20 pb-10 pt-4 flex items-center justify-center gap-4">
        {status === 'incoming' ? (
          <>
            <button
              onClick={declineCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition"
              title="Rechazar"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <button
              onClick={acceptCall}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-xl animate-ring-pulse"
              title="Aceptar"
            >
              <Phone className="w-7 h-7" />
            </button>
          </>
        ) : status === 'ended' ? null : (
          <>
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${activeCall.muted ? 'bg-white text-[#111b21]' : 'bg-white/15 hover:bg-white/25'}`}
              title={activeCall.muted ? 'Activar micrófono' : 'Silenciar'}
            >
              {activeCall.muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {kind === 'video' && (
              <button
                onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition ${!activeCall.cameraOn ? 'bg-white text-[#111b21]' : 'bg-white/15 hover:bg-white/25'}`}
                title={activeCall.cameraOn ? 'Apagar cámara' : 'Encender cámara'}
              >
                {activeCall.cameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </button>
            )}

            <button
              onClick={() => setShowReactions(s => !s)}
              className="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              title="Enviar sticker"
              disabled={status !== 'connected'}
            >
              <Smile className="w-6 h-6" />
            </button>

            <button
              className="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              title="Altavoz"
              onClick={() => {}}
            >
              {activeCall.speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            <button
              onClick={status === 'outgoing' ? declineCall : endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition"
              title="Finalizar llamada"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CallScreen;
