import React, { useRef, useState, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import CameraFeed from './CameraFeed'
import TranscriptionDisplay from './TranscriptionDisplay'
import '../styles/CallInterface.css'

interface CallInterfaceProps {
  memories: string[]
  voiceName: string
}

const CallInterface: React.FC<CallInterfaceProps> = ({ memories, voiceName }) => {
  const [isCallActive, setIsCallActive] = useState(false)
  const [transcriptions, setTranscriptions] = useState<any[]>([])
  const [status, setStatus] = useState('Desconectado')
  const cameraRef = useRef<HTMLDivElement>(null)
  const { sendVideo, isConnected, connect } = useWebSocket(
    memories,
    voiceName,
    (data) => handleWebSocketMessage(data)
  )

  const handleWebSocketMessage = (data: any) => {
    if (data.type === 'transcription') {
      setTranscriptions((prev) => [...prev, data])
    } else if (data.type === 'memory_saved') {
      console.log('💾 Memoria guardada:', data.fact)
    }
  }

  const startCall = async () => {
    if (!isConnected) {
      setStatus('Conectando...')
      connect()
      return
    }
    setIsCallActive(true)
    setStatus('En llamada')
    setTranscriptions([])
  }

  const endCall = () => {
    setIsCallActive(false)
    setStatus('Llamada finalizada')
  }

  return (
    <div className="call-interface">
      <div className="call-header">
        <h2>🎥 Video Llamada en Vivo</h2>
        <div className="status-indicator">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{status}</span>
        </div>
      </div>

      <div className="call-content">
        <div className="camera-section" ref={cameraRef}>
          <CameraFeed isActive={isCallActive} onFrameCapture={sendVideo} />
        </div>

        <div className="transcription-section">
          <TranscriptionDisplay transcriptions={transcriptions} />
        </div>
      </div>

      <div className="call-controls">
        <div className="voice-info">
          <span className="voice-label">🎤 Voz: <strong>{voiceName}</strong></span>
        </div>

        <div className="call-buttons">
          {!isCallActive ? (
            <button
              className="btn btn-start"
              onClick={startCall}
              disabled={!isConnected}
            >
              ▶️ Iniciar Llamada
            </button>
          ) : (
            <button className="btn btn-end" onClick={endCall}>
              ⏹️ Terminar Llamada
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CallInterface
