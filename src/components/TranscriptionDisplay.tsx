import React from 'react'
import '../styles/TranscriptionDisplay.css'

interface Transcription {
  role: 'user' | 'model'
  text: string
  finished?: boolean
}

interface TranscriptionDisplayProps {
  transcriptions: Transcription[]
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  transcriptions,
}) => {
  return (
    <div className="transcription-display">
      <h3>💬 Conversación en Vivo</h3>
      <div className="messages-container">
        {transcriptions.length === 0 ? (
          <div className="empty-state">
            <p>Esperando conversación...</p>
            <small>Inicia la llamada para comenzar</small>
          </div>
        ) : (
          transcriptions.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <span className="role-badge">{msg.role === 'user' ? '👤' : '🤖'}</span>
              <div className="message-content">
                <p>{msg.text}</p>
                {msg.finished === false && <span className="typing-indicator">●●●</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default TranscriptionDisplay
