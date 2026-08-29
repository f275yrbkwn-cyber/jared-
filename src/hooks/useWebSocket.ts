import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketMessage {
  type?: string
  audio?: string
  video?: string
  transcription?: any
  memory_saved?: boolean
  fact?: string
  interrupted?: boolean
}

export const useWebSocket = (
  memories: string[],
  voiceName: string,
  onMessage: (data: WebSocketMessage) => void
) => {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const memoriesParam = encodeURIComponent(JSON.stringify(memories))
    return `${protocol}//${window.location.host}/ws/live?voice=${voiceName}&memories=${memoriesParam}`
  }, [memories, voiceName])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const wsUrl = getWsUrl()
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        setIsConnected(true)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage(data)
        } catch (error) {
          console.error('Error parsing WS message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log('❌ WebSocket disconnected')
        setIsConnected(false)
        attemptReconnect()
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Error creating WebSocket:', error)
      attemptReconnect()
    }
  }, [getWsUrl, onMessage])

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000)
      console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`)
      setTimeout(() => connect(), delay)
    }
  }, [connect])

  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendVideo = useCallback((frameBase64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ video: frameBase64 }))
    }
  }, [])

  const sendAudio = useCallback((audioBase64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ audio: audioBase64 }))
    }
  }, [])

  return {
    isConnected,
    sendVideo,
    sendAudio,
    connect,
  }
}
