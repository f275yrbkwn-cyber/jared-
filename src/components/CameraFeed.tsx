import React, { useRef, useEffect, useState } from 'react'
import '../styles/CameraFeed.css'

interface CameraFeedProps {
  isActive: boolean
  onFrameCapture: (frame: string) => void
}

const CameraFeed: React.FC<CameraFeedProps> = ({ isActive, onFrameCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setIsCameraReady(true)
          setError(null)
        }
      } catch (error) {
        console.error('Error accessing camera:', error)
        setError('No se pudo acceder a la cámara')
      }
    }

    initCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (isActive && isCameraReady) {
      frameIntervalRef.current = setInterval(() => {
        captureFrame()
      }, 500)
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
    }
  }, [isActive, isCameraReady])

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
      canvasRef.current.toBlob(
        (blob) => {
          if (blob) {
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64 = reader.result as string
              onFrameCapture(base64.split(',')[1])
            }
            reader.readAsDataURL(blob)
          }
        },
        'image/jpeg',
        0.7
      )
    }
  }

  return (
    <div className="camera-feed">
      {error ? (
        <div className="camera-error">
          <p>⚠️ {error}</p>
          <small>Verifica los permisos de cámara en tu navegador</small>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="video-element" />
          <canvas ref={canvasRef} width={1280} height={720} style={{ display: 'none' }} />
          <div className="camera-status">
            {isCameraReady ? (
              <span className="status-badge ready">🎥 Cámara Lista</span>
            ) : (
              <span className="status-badge loading">⏳ Inicializando...</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default CameraFeed
