import { useState, useRef, useEffect, useCallback } from 'react';
import { pcmToBase64 } from '../lib/audio';
import { AudioPlayer } from '../lib/AudioPlayer';

type CallState = 'idle' | 'connecting' | 'connected' | 'error';

export interface Transcript {
  id: string;
  role: 'user' | 'model';
  text: string;
  finished: boolean;
}

// 1-second silent audio loop encoded in base64 to keep background audio & WebSocket execution active in mobile OS
const SILENT_AUDIO_URI = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export function useLiveCall() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoFrozen, setIsVideoFrozen] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const videoIntervalRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Use a ref for isMuted to access inside onaudioprocess callback
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const isVideoFrozenRef = useRef(isVideoFrozen);
  useEffect(() => {
    isVideoFrozenRef.current = isVideoFrozen;
  }, [isVideoFrozen]);

  const toggleFreezeVideo = useCallback(() => {
    setIsVideoFrozen(prev => !prev);
  }, []);

  // Request screen wake lock to avoid phone turning off automatically
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn('Wake Lock release failed:', err);
      }
    }
  }, []);

  // Setup MediaSession for background audio & lockscreen controls
  const setupMediaSession = useCallback((disconnectFn: () => void) => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Llamada Privada - Jared Alejandro',
          artist: 'Jared Alejandro García Bautista',
          album: 'Llamada en Curso (Micrófono Activo)'
        });

        navigator.mediaSession.playbackState = 'playing';

        try {
          navigator.mediaSession.setActionHandler('stop', () => {
            disconnectFn();
          });
          navigator.mediaSession.setActionHandler('pause', () => {
            disconnectFn();
          });
          (navigator.mediaSession.setActionHandler as any)('hangup', () => {
            disconnectFn();
          });
        } catch (e) {}
      } catch (e) {
        console.warn('MediaSession setup failed:', e);
      }
    }
  }, []);

  const clearMediaSession = useCallback(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } catch (e) {}
    }
  }, []);

  const startSilentAudioKeepalive = useCallback(() => {
    try {
      if (!silentAudioRef.current) {
        // Create an audio element with an inaudible tone wav loop
        const audio = new Audio(SILENT_AUDIO_URI);
        audio.loop = true;
        audio.volume = 0.01;
        audio.setAttribute('playsinline', 'true');
        audio.setAttribute('webkit-playsinline', 'true');
        audio.setAttribute('autoplay', 'true');
        silentAudioRef.current = audio;
      }
      silentAudioRef.current.play().catch(e => console.warn('Silent audio play failed:', e));
    } catch (e) {
      console.warn('Keepalive audio failed:', e);
    }
  }, []);

  const stopSilentAudioKeepalive = useCallback(() => {
    if (silentAudioRef.current) {
      try {
        silentAudioRef.current.pause();
        silentAudioRef.current.currentTime = 0;
      } catch (e) {}
      silentAudioRef.current = null;
    }
  }, []);

  // Background Web Worker to keep timers running even when phone screen is locked
  const startBackgroundWorker = useCallback(() => {
    try {
      if (!workerRef.current) {
        const workerBlob = new Blob([
          `let interval = null;
           self.onmessage = function(e) {
             if (e.data === 'start') {
               if (interval) clearInterval(interval);
               interval = setInterval(function() {
                 self.postMessage('tick');
               }, 2000);
             } else if (e.data === 'stop') {
               if (interval) clearInterval(interval);
               interval = null;
             }
           };`
        ], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(workerUrl);
        worker.onmessage = () => {
          // Send ping to keep WebSocket active
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
          }
          // Check and resume AudioContexts if suspended by mobile OS
          if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
            inputCtxRef.current.resume().catch(console.warn);
          }
          if (audioPlayerRef.current && audioPlayerRef.current.ctx.state === 'suspended') {
            audioPlayerRef.current.ctx.resume().catch(console.warn);
          }
        };
        workerRef.current = worker;
      }
      workerRef.current.postMessage('start');
    } catch (e) {
      console.warn('Background worker creation failed:', e);
    }
  }, []);

  const stopBackgroundWorker = useCallback(() => {
    if (workerRef.current) {
      try {
        workerRef.current.postMessage('stop');
        workerRef.current.terminate();
      } catch (e) {}
      workerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current && inputCtxRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(console.warn);
      inputCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
      videoElementRef.current = null;
    }
    
    stopBackgroundWorker();
    releaseWakeLock();
    stopSilentAudioKeepalive();
    clearMediaSession();
    
    setCallState('idle');
  }, [releaseWakeLock, stopSilentAudioKeepalive, clearMediaSession, stopBackgroundWorker]);

  const connect = useCallback(async (voice: string = 'Fenrir') => {
    try {
      setCallState('connecting');
      setError(null);
      
      // Start background keepalive audio immediately inside user gesture
      startSilentAudioKeepalive();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });
      streamRef.current = stream;
      
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live?voice=${encodeURIComponent(voice)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      const audioPlayer = new AudioPlayer(24000);
      audioPlayerRef.current = audioPlayer;

      audioPlayer.ctx.onstatechange = () => {
        if (audioPlayer.ctx.state === 'suspended') {
          audioPlayer.ctx.resume().catch(console.warn);
        }
      };
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      inputCtxRef.current = inputCtx;

      inputCtx.onstatechange = () => {
        if (inputCtx.state === 'suspended') {
          inputCtx.resume().catch(console.warn);
        }
      };
      
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(inputCtx.destination);
      
      ws.onopen = () => {
        setCallState('connected');
        requestWakeLock();
        setupMediaSession(disconnect);
        startBackgroundWorker();
        
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };

        // Video capture loop (Token-optimized at ~0.4 FPS, 400x300)
        try {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.playsInline = true;
          video.muted = true;
          video.play().catch(console.warn);
          videoElementRef.current = video;

          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 300;
          canvasRef.current = canvas;
          const ctx = canvas.getContext('2d');

          videoIntervalRef.current = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN && !isVideoFrozenRef.current && ctx && video.readyState >= video.HAVE_CURRENT_DATA) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
              const base64 = dataUrl.split(',')[1];
              if (base64) {
                ws.send(JSON.stringify({ video: base64 }));
              }
            }
          }, 2500); // 2.5s interval dramatically saves tokens and avoids quota freezing
        } catch (err) {
          console.warn("Video capture setup failed:", err);
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong') {
            return;
          }
          if (msg.audio) {
            audioPlayer.playChunk(msg.audio);
          }
          if (msg.interrupted) {
            audioPlayer.clearQueue();
          }
          if (msg.type === 'transcription') {
            setTranscripts(prev => {
              let lastIndex = -1;
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].role === msg.role && !prev[i].finished) {
                  lastIndex = i;
                  break;
                }
              }
              if (lastIndex >= 0) {
                const newTranscripts = [...prev];
                newTranscripts[lastIndex] = { ...newTranscripts[lastIndex], text: msg.text, finished: msg.finished };
                return newTranscripts;
              } else {
                return [...prev, { id: Date.now().toString() + Math.random(), role: msg.role, text: msg.text, finished: msg.finished }];
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse message", e);
        }
      };
      
      ws.onerror = () => {
        setCallState('error');
        setError("Error de conexión con el servidor");
        disconnect();
      };
      
      ws.onclose = () => {
        disconnect();
      };
      
    } catch (err: any) {
      setCallState('error');
      setError(err.message || "Error al iniciar la llamada");
      disconnect();
    }
  }, [disconnect, requestWakeLock, setupMediaSession, startSilentAudioKeepalive, startBackgroundWorker]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Handle visibility changes (e.g. screen lock, tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (callState === 'connected') {
        // Resume AudioContexts if they were suspended by the OS
        if (inputCtxRef.current && inputCtxRef.current.state === 'suspended') {
          inputCtxRef.current.resume().catch(console.warn);
        }
        if (audioPlayerRef.current) {
          audioPlayerRef.current.resume();
        }
        if (document.visibilityState === 'visible') {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callState, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    callState,
    error,
    isMuted,
    isVideoFrozen,
    transcripts,
    connect,
    disconnect,
    toggleMute,
    toggleFreezeVideo
  };
}
