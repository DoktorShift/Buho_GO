"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera, X } from "lucide-react"

interface QrScannerProps {
  onScan: (data: string) => void
  onClose?: () => void
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasCamera, setHasCamera] = useState(true)

  // Cleanup function for camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const startScanner = async () => {
    setIsScanning(true)
    setError(null)

    try {
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()

        // Start scanning once video is playing
        videoRef.current.onloadedmetadata = () => {
          scanQRCode()
        }
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setError("Could not access camera. Please check permissions.")
      setIsScanning(false)
      setHasCamera(false)
    }
  }

  const scanQRCode = async () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      // Use the jsQR library to detect QR codes
      if (typeof window !== "undefined" && window.jsQR) {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        })

        if (code) {
          // QR code detected
          stopCamera()
          onScan(code.data)
          if (onClose) onClose()
          return
        }
      }
    } catch (error) {
      console.error("QR scanning error:", error)
    }

    // If we're still scanning, request the next frame
    if (isScanning) {
      requestAnimationFrame(scanQRCode)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square max-w-[300px] mx-auto bg-gray-100 rounded-lg overflow-hidden">
        {isScanning ? (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-0" />
            <div className="absolute inset-0 border-[40px] border-black/50 box-border pointer-events-none">
              <div className="absolute inset-0 border-2 border-white/70"></div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 bg-white/80"
              onClick={() => {
                stopCamera()
                if (onClose) onClose()
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Camera className="h-12 w-12 text-gray-400 mb-2" />
            <Button
              onClick={startScanner}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!hasCamera}
            >
              Scan QR Code
            </Button>
            {error && <p className="text-destructive text-sm mt-2">{error}</p>}
            {!hasCamera && <p className="text-sm text-gray-500 mt-2">Camera access is required to scan QR codes.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// Add type definition for the jsQR library
declare global {
  interface Window {
    jsQR: any
  }
}

