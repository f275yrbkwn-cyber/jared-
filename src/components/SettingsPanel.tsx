import React from 'react'
import '../styles/SettingsPanel.css'

interface SettingsPanelProps {
  voiceName: string
  onVoiceChanged: (voice: string) => void
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ voiceName, onVoiceChanged }) => {
  const voiceOptions = ['Fenrir', 'Puck', 'Charon', 'Kore', 'Breeze', 'Cove', 'Juniper']

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>⚙️ Configuración</h2>
        <p>Personaliza tu experiencia con Jared</p>
      </div>

      <div className="settings-content">
        <div className="settings-group">
          <h3>🎤 Seleccionar Voz</h3>
          <p className="setting-description">Elige la voz con la que Jared se comunicará contigo</p>
          <div className="voice-grid">
            {voiceOptions.map((voice) => (
              <button
                key={voice}
                className={`voice-btn ${voiceName === voice ? 'active' : ''}`}
                onClick={() => onVoiceChanged(voice)}
              >
                <span className="voice-name">{voice}</span>
                <span className="voice-indicator">🔊</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-group">
          <h3>📊 Información de la Sesión</h3>
          <div className="info-box">
            <p>
              <strong>Voz Actual:</strong> <span>{voiceName}</span>
            </p>
            <p>
              <strong>Tokens:</strong> <span>Ilimitados ∞</span>
            </p>
            <p>
              <strong>Almacenamiento:</strong> <span>IndexedDB (Local)</span>
            </p>
            <p>
              <strong>API:</strong> <span>Gemini Live Preview</span>
            </p>
          </div>
        </div>

        <div className="settings-group">
          <h3>ℹ️ Acerca de Jared</h3>
          <div className="about-box">
            <p>
              Jared es tu compañero de IA personalizado que puede ver a través de tu cámara, recordar
              cada detalle sobre ti, y mantener conversaciones naturales y proactivas.
            </p>
            <ul>
              <li>✅ Visión por cámara en tiempo real</li>
              <li>✅ Memoria perfecta e infalible</li>
              <li>✅ Respuestas proactivas sin esperar</li>
              <li>✅ Voz personalizable</li>
              <li>✅ Tokens ilimitados</li>
              <li>✅ Datos guardados localmente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
