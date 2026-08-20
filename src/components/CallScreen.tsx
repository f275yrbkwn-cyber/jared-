import React, { useEffect, useState, useRef } from 'react';
import { useLiveCall } from '../hooks/useLiveCall';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings2,
  MessageSquare,
  Brain,
  MessageCircle,
  Sparkles,
  Database
} from 'lucide-react';
import { initAuth, googleSignIn, logout } from '../lib/auth';
import {
  testFirestoreConnection,
  saveUserProfile,
  createConversation,
  updateConversation,
  saveMemory,
  subscribeToMemories,
  seedInitialMemories
} from '../lib/firestore';
import { User } from 'firebase/auth';
import { Memory } from '../types';
import { ConversationHistoryModal } from './ConversationHistoryModal';
import { TextChatDrawer } from './TextChatDrawer';

export function CallScreen() {
  const {
    callState,
    error,
    isMuted,
    isVideoFrozen,
    transcripts,
    connect,
    disconnect,
    toggleMute,
    toggleFreezeVideo
  } = useLiveCall();
  const [duration, setDuration] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('Fenrir');
  const [showSettings, setShowSettings] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Modals & Drawers state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyModalTab, setHistoryModalTab] = useState<'history' | 'memories'>('history');
  const [showTextChat, setShowTextChat] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);

  // Track current active conversation ID in Firestore
  const activeConversationIdRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  durationRef.current = duration;
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Auto-scroll to bottom of transcripts
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  // Camera preview stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (callState === 'connected') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(s => {
          activeStream = s;
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = s;
          }
        })
        .catch(console.warn);
    } else {
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    }
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [callState]);

  const voices = [
    { id: 'Fenrir', name: 'Jared (Natural y Cálida - Recomendada)' },
    { id: 'Puck', name: 'Jared (Juvenil y Expresiva)' },
    { id: 'Charon', name: 'Jared (Grave y Profunda)' },
    { id: 'Zephyr', name: 'Jared (Serena y Tranquila)' },
    { id: 'Aoede', name: 'Aoede (Femenina Alternativa)' }
  ];

  // Test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Auth observer
  useEffect(() => {
    const unsubscribe = initAuth(
      async (currentUser) => {
        setUser(currentUser);
        setNeedsAuth(false);
        if (currentUser) {
          await saveUserProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName
          });
          await seedInitialMemories(currentUser.uid);
        }
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Listen to user memories in Firestore
  useEffect(() => {
    if (!user) {
      setMemories([]);
      return;
    }
    const unsubscribe = subscribeToMemories(user.uid, (data) => {
      setMemories(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await saveUserProfile({
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        });
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
  };

  // Timer & Firestore conversation lifecycle
  useEffect(() => {
    let timer: number;
    if (callState === 'connected') {
      timer = window.setInterval(() => setDuration(prev => prev + 1), 1000);
    } else {
      if (durationRef.current > 0 && user && activeConversationIdRef.current) {
        // Update session duration in Firestore
        updateConversation(user.uid, activeConversationIdRef.current, {
          durationSeconds: durationRef.current
        }).catch(console.error);
      }
      setDuration(0);
      activeConversationIdRef.current = null;
    }
    return () => clearInterval(timer);
  }, [callState, user]);

  const handleStartCall = async () => {
    if (user) {
      try {
        const convId = await createConversation(
          user.uid,
          `Llamada con Jared (${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})`,
          selectedVoice
        );
        activeConversationIdRef.current = convId;
      } catch (e) {
        console.error("Could not register conversation in Firestore:", e);
      }
    }

    const memoryFacts = memories.map(m => m.fact);
    await connect(selectedVoice, memoryFacts, async (fact: string) => {
      if (user) {
        try {
          await saveMemory(user.uid, fact);
        } catch (err) {
          console.error("Error saving memory to Firestore:", err);
        }
      }
    });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="h-screen w-full bg-[#080808] text-[#e0e0e0] font-sans flex flex-col relative overflow-hidden">
      {/* Background blurs */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff2e63] rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#08d9d6] rounded-full blur-[150px]"></div>
      </div>
      
      {/* Live Camera PiP Preview */}
      {callState === 'connected' && (
        <div className="absolute top-24 right-4 sm:right-10 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border border-[#08d9d6]/30 shadow-[0_0_20px_rgba(8,217,214,0.2)] bg-black z-30 animate-in fade-in zoom-in-95">
          <video ref={videoPreviewRef} autoPlay playsInline muted className={`w-full h-full object-cover -scale-x-100 ${isVideoFrozen ? 'opacity-40 grayscale' : ''}`} />
          <button
            onClick={toggleFreezeVideo}
            className={`absolute bottom-2 left-2 right-2 px-2 py-1 rounded-full backdrop-blur-md text-[9px] font-mono flex items-center justify-center gap-1.5 border transition-all ${
              isVideoFrozen 
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/30' 
                : 'bg-black/70 text-[#08d9d6] border-[#08d9d6]/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isVideoFrozen ? 'bg-amber-400' : 'bg-[#08d9d6] animate-pulse'}`}></span>
            <span>{isVideoFrozen ? 'TOKENS CONGELADOS' : 'CAM STREAM ACTIVO'}</span>
          </button>
        </div>
      )}
      
      {/* Header */}
      <header className="z-10 flex justify-between items-center p-4 sm:p-6 md:p-10 border-b border-white/5 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
          <span className="text-xs tracking-[0.25em] uppercase font-bold text-[#08d9d6]">Línea Directa</span>
          {user && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              <Database className="w-2.5 h-2.5" /> Firestore Activo
            </span>
          )}
        </div>

        {/* Action buttons: Historial, Memorias, Chat */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => { setHistoryModalTab('history'); setShowHistoryModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all shadow-sm"
            title="Ver historial de charlas"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#08d9d6]" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          <button
            onClick={() => { setHistoryModalTab('memories'); setShowHistoryModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all shadow-sm"
            title="Ver recuerdos de Jared"
          >
            <Brain className="w-3.5 h-3.5 text-[#ff2e63]" />
            <span className="hidden sm:inline">Memoria</span>
            {memories.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#ff2e63]/20 text-[#ff2e63] text-[9px] font-bold flex items-center justify-center">
                {memories.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowTextChat(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08d9d6]/10 hover:bg-[#08d9d6]/20 border border-[#08d9d6]/30 text-xs font-medium text-[#08d9d6] transition-all shadow-sm"
            title="Chatear por texto"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat</span>
          </button>
        </div>
      </header>

      {/* Main Call View */}
      <main className="z-10 flex-1 flex flex-col items-center justify-center -mt-6 sm:-mt-10 px-4">
        {/* Avatar area */}
        <div className="relative group">
          <div className={`absolute -inset-4 bg-gradient-to-tr from-[#08d9d6] to-[#ff2e63] rounded-full blur opacity-30 ${callState === 'connected' ? 'animate-pulse' : ''}`}></div>
          <div className="w-44 h-44 sm:w-64 sm:h-64 rounded-full border border-white/10 bg-black flex items-center justify-center relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-white/10"></div>
            <div className="flex flex-col items-center z-10">
               <span className="text-4xl sm:text-6xl font-light tracking-wider text-white/95">JG</span>
               <span className="text-[10px] tracking-[0.3em] uppercase mt-2 sm:mt-3 text-[#08d9d6] text-center px-4 font-mono">
                 {callState === 'idle' && 'Listo para conectar'}
                 {callState === 'connecting' && 'Marcando...'}
                 {callState === 'connected' && 'En llamada activa'}
                 {callState === 'error' && 'Llamada finalizada'}
               </span>
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-10 text-center max-w-lg">
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-white mb-2 uppercase">
            JARED ALEJANDRO <span className="text-[#08d9d6] font-normal">GARCÍA BAUTISTA</span>
          </h1>
          <p className="text-xs sm:text-sm font-light text-white/60 italic px-4">
            {error ? error : callState === 'connected' ? 'Escuchando activamente... Habla con total confianza' : '«Aquí estoy compa, llámame o escríbeme cuando quieras charlar.»'}
          </p>

          {/* Quick status badges */}
          {user && memories.length > 0 && callState === 'idle' && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70">
              <Sparkles className="w-3 h-3 text-[#08d9d6]" />
              <span>Jared recuerda {memories.length} dato{memories.length > 1 ? 's' : ''} sobre ti</span>
            </div>
          )}
        </div>

        {/* Audio Visualizer */}
        <div className={`mt-6 sm:mt-10 flex items-end gap-1 h-10 transition-opacity duration-500 ${callState === 'connected' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-1.5 h-3 bg-white/20 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
          <div className="w-1.5 h-6 bg-white/40 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
          <div className="w-1.5 h-10 bg-[#08d9d6] rounded-full animate-[bounce_1s_infinite_200ms]"></div>
          <div className="w-1.5 h-5 bg-white/40 rounded-full animate-[bounce_1s_infinite_300ms]"></div>
          <div className="w-1.5 h-8 bg-white/60 rounded-full animate-[bounce_1s_infinite_400ms]"></div>
          <div className="w-1.5 h-3 bg-white/20 rounded-full animate-[bounce_1s_infinite_500ms]"></div>
          <div className="w-1.5 h-10 bg-[#ff2e63] rounded-full animate-[bounce_1s_infinite_600ms]"></div>
          <div className="w-1.5 h-7 bg-white/40 rounded-full animate-[bounce_1s_infinite_700ms]"></div>
          <div className="w-1.5 h-4 bg-white/20 rounded-full animate-[bounce_1s_infinite_800ms]"></div>
          <div className="w-1.5 h-9 bg-[#08d9d6] rounded-full animate-[bounce_1s_infinite_900ms]"></div>
          <div className="w-1.5 h-3 bg-white/20 rounded-full animate-[bounce_1s_infinite_1000ms]"></div>
        </div>

        {/* Transcription Log */}
        {callState === 'connected' && (
          <div className="w-full max-w-lg mt-8 h-32 overflow-y-auto flex flex-col gap-3 scroll-smooth px-4 custom-scrollbar">
            {transcripts.map((t) => (
              <div key={t.id} className={`flex flex-col ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] uppercase tracking-widest opacity-40 font-mono mb-1">
                  {t.role === 'user' ? 'Tú' : 'Jared'}
                </span>
                <div className={`px-4 py-2 rounded-2xl text-sm ${
                  t.role === 'user' 
                    ? 'bg-white/10 text-white/90 rounded-br-none' 
                    : 'bg-[#08d9d6]/10 text-[#08d9d6] rounded-bl-none border border-[#08d9d6]/20'
                }`}>
                  {t.text}
                  {!t.finished && <span className="inline-block w-1 h-1 bg-current rounded-full animate-ping ml-2"></span>}
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </main>

      {/* Footer Controls */}
      <footer className="z-10 p-6 sm:p-10 flex flex-col items-center gap-6 relative">
        <div className="flex items-center gap-3 sm:gap-6">
          <button 
            onClick={callState === 'connected' ? toggleMute : undefined}
            title={isMuted ? "Activar micrófono" : "Silenciar micrófono"}
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex items-center justify-center transition-colors ${
              callState === 'connected' 
                ? isMuted 
                  ? 'bg-white/20 border-[#ff2e63]/50 text-[#ff2e63]' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Token Freezing / Video Pause button */}
          <button 
            onClick={callState === 'connected' ? toggleFreezeVideo : undefined}
            title={isVideoFrozen ? "Descongelar cámara (Reanudar streaming de video)" : "Congelar tokens / Pausar video (Ahorro de tokens)"}
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex items-center justify-center transition-colors ${
              callState === 'connected' 
                ? isVideoFrozen 
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-400' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-[#08d9d6]'
                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            {isVideoFrozen ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          {callState === 'idle' || callState === 'error' ? (
            <button 
              onClick={handleStartCall}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#08d9d6] flex items-center justify-center shadow-[0_0_35px_rgba(8,217,214,0.4)] hover:bg-[#06b8b5] transition-transform active:scale-95"
            >
              <Phone size={30} className="fill-current text-black" />
            </button>
          ) : (
            <button 
              onClick={disconnect}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#ff2e63] flex items-center justify-center shadow-[0_0_35px_rgba(255,46,99,0.4)] hover:bg-[#e02554] transition-transform active:scale-95"
            >
              <PhoneOff size={30} className="fill-current text-white" />
            </button>
          )}

          <button 
            onClick={() => callState === 'idle' && setShowSettings(!showSettings)}
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border flex items-center justify-center transition-colors relative ${
              callState === 'idle'
                ? (showSettings ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white')
                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
            }`}
          >
            <Settings2 size={22} />
          </button>
        </div>

        {/* Settings Flyout */}
        {showSettings && callState === 'idle' && (
          <div className="absolute bottom-28 bg-[#121212] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-72 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-xs tracking-widest uppercase text-[#08d9d6] mb-3">Voz del Sistema</h3>
            <div className="flex flex-col gap-1.5 mb-4">
              {voices.map(v => (
                <button 
                  key={v.id}
                  onClick={() => { setSelectedVoice(v.id); }}
                  className={`text-left text-xs px-3 py-2 rounded-lg transition-colors ${selectedVoice === v.id ? 'bg-[#08d9d6]/20 text-[#08d9d6] font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                >
                  {v.name}
                </button>
              ))}
            </div>

            <h3 className="text-xs tracking-widest uppercase text-[#08d9d6] mb-3 border-t border-white/10 pt-4">Cuenta & Firestore</h3>
            <div className="flex flex-col gap-2">
              {needsAuth ? (
                <button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  {isLoggingIn ? 'Conectando...' : 'Iniciar Sesión con Google'}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="px-3 py-2 rounded-lg bg-white/5 text-[11px] text-white/70">
                    <p className="text-white font-medium truncate">{user?.displayName || 'Usuario'}</p>
                    <p className="truncate text-white/50">{user?.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="text-center text-xs px-3 py-2 rounded-lg text-red-400 hover:bg-white/5 transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-4 items-center">
          <span className="text-[10px] sm:text-xs font-mono opacity-40">
            TIEMPO: {callState === 'connected' ? formatTime(duration) : '00:00:00'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${callState === 'connected' ? 'bg-[#08d9d6] shadow-[0_0_8px_#08d9d6]' : 'bg-neutral-600'}`}></span>
          <span className={`text-[10px] sm:text-xs font-mono ${callState === 'connected' ? 'text-[#08d9d6]' : 'text-neutral-500'}`}>
            {callState === 'connected' ? 'ENLACE ACTIVO' : 'EN ESPERA'}
          </span>
        </div>
      </footer>

      {/* Modal: History & Memories */}
      <ConversationHistoryModal
        user={user}
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        initialTab={historyModalTab}
      />

      {/* Drawer: Text Chat with Jared */}
      <TextChatDrawer
        user={user}
        isOpen={showTextChat}
        onClose={() => setShowTextChat(false)}
        memories={memories}
      />
    </div>
  );
}
