import React, { useState } from 'react'
import '../styles/MemoryManager.css'

interface MemoryManagerProps {
  memories: string[]
  onMemoryAdded: (memory: string) => void
}

const MemoryManager: React.FC<MemoryManagerProps> = ({ memories, onMemoryAdded }) => {
  const [newMemory, setNewMemory] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return

    setLoading(true)
    try {
      const db = await openDB()
      const tx = db.transaction('memories', 'readwrite')
      const store = tx.objectStore('memories')

      await new Promise<void>((resolve, reject) => {
        const request = store.add({ fact: newMemory, createdAt: new Date() })
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      onMemoryAdded(newMemory)
      setNewMemory('')
      setSuccessMessage('✅ Recuerdo guardado exitosamente!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (error) {
      console.error('Error saving memory:', error)
      alert('❌ Error al guardar el recuerdo')
    } finally {
      setLoading(false)
    }
  }

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JaredCompanionDB', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  return (
    <div className="memory-manager">
      <div className="memory-header">
        <h2>🧠 Gestor de Recuerdos</h2>
        <p>Añade datos que Jared debe recordar y respetar fielmente</p>
      </div>

      <div className="memory-form">
        <textarea
          value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          placeholder="Ej: Me llamo Juan y soy ingeniero. Me encanta el café y programar en mi tiempo libre. Tengo un gato llamado Misi..."
          className="memory-input"
          rows={5}
        />
        <div className="form-actions">
          <button
            onClick={handleAddMemory}
            disabled={loading || !newMemory.trim()}
            className="btn btn-add"
          >
            {loading ? '⏳ Guardando...' : '➕ Guardar Recuerdo'}
          </button>
          {successMessage && <span className="success-message">{successMessage}</span>}
        </div>
      </div>

      <div className="memories-list">
        <h3>📚 Recuerdos Guardados ({memories.length})</h3>
        {memories.length === 0 ? (
          <div className="empty-memories">
            <p>No hay recuerdos guardados aún</p>
            <small>Los recuerdos que añadas aquí serán respetados al pie de la letra por Jared</small>
          </div>
        ) : (
          <div className="memories-container">
            {memories.map((memory, idx) => (
              <div key={idx} className="memory-item">
                <span className="memory-number">{idx + 1}</span>
                <p>{memory}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MemoryManager
