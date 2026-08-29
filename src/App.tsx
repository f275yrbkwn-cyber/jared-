import React, { useState, useEffect } from 'react'
import CallInterface from './components/CallInterface'
import MemoryManager from './components/MemoryManager'
import SettingsPanel from './components/SettingsPanel'
import './App.css'

type View = 'call' | 'memories' | 'settings'

function App() {
  const [currentView, setCurrentView] = useState<View>('call')
  const [memories, setMemories] = useState<string[]>([])
  const [voiceName, setVoiceName] = useState('Fenrir')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize IndexedDB and load memories on mount
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      await setupIndexedDB()
      await loadMemoriesFromDB()
      const savedVoice = localStorage.getItem('jared_voice') || 'Fenrir'
      setVoiceName(savedVoice)
    } catch (error) {
      console.error('Error initializing app:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const setupIndexedDB = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JaredCompanionDB', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('memories')) {
          db.createObjectStore('memories', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id', autoIncrement: true })
        }
      }
    })
  }

  const loadMemoriesFromDB = async () => {
    try {
      const db = await openDB()
      const tx = db.transaction('memories', 'readonly')
      const store = tx.objectStore('memories')
      const allMemories = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      setMemories(allMemories.map((m) => m.fact))
    } catch (error) {
      console.warn('Failed to load memories:', error)
    }
  }

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JaredCompanionDB', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  const handleMemoryAdded = (memory: string) => {
    setMemories((prev) => [...prev, memory])
  }

  const handleVoiceChanged = (newVoice: string) => {
    setVoiceName(newVoice)
    localStorage.setItem('jared_voice', newVoice)
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Inicializando Jared...</p>
      </div>
    )
  }

  return (
    <div className="app-container">
      <nav className="nav-bar">
        <h1 className="title">🎤 Jared Companion</h1>
        <div className="nav-buttons">
          <button
            className={`nav-btn ${currentView === 'call' ? 'active' : ''}`}
            onClick={() => setCurrentView('call')}
            title="Llamada en vivo"
          >
            💬 Llamada
          </button>
          <button
            className={`nav-btn ${currentView === 'memories' ? 'active' : ''}`}
            onClick={() => setCurrentView('memories')}
            title="Gestionar recuerdos"
          >
            🧠 Recuerdos
          </button>
          <button
            className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentView('settings')}
            title="Configuración"
          >
            ⚙️ Config
          </button>
        </div>
      </nav>

      <main className="main-content">
        {currentView === 'call' && (
          <CallInterface memories={memories} voiceName={voiceName} />
        )}
        {currentView === 'memories' && (
          <MemoryManager memories={memories} onMemoryAdded={handleMemoryAdded} />
        )}
        {currentView === 'settings' && (
          <SettingsPanel voiceName={voiceName} onVoiceChanged={handleVoiceChanged} />
        )}
      </main>
    </div>
  )
}

export default App
