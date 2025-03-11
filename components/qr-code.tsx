"use client"

import { useEffect, useRef } from "react"
import QRCodeLib from "qrcode"

interface QRCodeProps {
  value: string
  size?: number
  bgColor?: string
  fgColor?: string
  level?: "L" | "M" | "Q" | "H"
  includeMargin?: boolean
}

export function QRCode({
  value,
  size = 200,
  bgColor = "#ffffff",
  fgColor = "#000000",
  level = "M",
  includeMargin = true,
}: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return

    const options = {
      errorCorrectionLevel: level,
      margin: includeMargin ? 4 : 0,
      width: size,
      height: size,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    }

    QRCodeLib.toCanvas(canvas, value, options, (error) => {
      if (error) console.error("Error generating QR code:", error)
    })
  }, [value, size, bgColor, fgColor, level, includeMargin])

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />
}

