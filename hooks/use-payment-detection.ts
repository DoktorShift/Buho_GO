"use client"

import { useState, useEffect, useCallback } from "react"
import { useWallet } from "@/context/wallet-context"

interface PaymentDetectionOptions {
  invoice: string
  onPaymentReceived: () => void
  enabled?: boolean
}

export function usePaymentDetection({ invoice, onPaymentReceived, enabled = true }: PaymentDetectionOptions) {
  const { checkInvoice } = useWallet()
  const [isChecking, setIsChecking] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)

  // Function to check payment status via REST API
  const checkPayment = useCallback(async () => {
    if (!invoice || !enabled || isChecking) return false

    setIsChecking(true)
    try {
      const result = await checkInvoice(invoice)
      if (result?.result?.settled_at) {
        onPaymentReceived()
        return true
      }
      return false
    } catch (error) {
      console.error("Error checking payment:", error)
      return false
    } finally {
      setIsChecking(false)
    }
  }, [invoice, enabled, isChecking, checkInvoice, onPaymentReceived])

  // Smart polling with increasing intervals
  useEffect(() => {
    if (!invoice || !enabled) return

    let pollCount = 0
    let timeoutId: NodeJS.Timeout

    const poll = async () => {
      const isPaid = await checkPayment()

      if (!isPaid && enabled) {
        // Calculate next interval:
        // Start with 2s, then 3s, 5s, 8s, 13s (Fibonacci-like)
        // Max out at 13 seconds
        const intervals = [2000, 3000, 5000, 8000, 13000]
        const nextInterval = intervals[Math.min(pollCount, intervals.length - 1)]
        pollCount++

        timeoutId = setTimeout(poll, nextInterval)
      }
    }

    // Start polling
    poll()

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [invoice, enabled, checkPayment])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!invoice || !enabled) return

    // Try to establish WebSocket connection
    try {
      const wsUrl = `wss://api.example.com/v1/invoice/${invoice}/ws` // Replace with your WebSocket endpoint
      const websocket = new WebSocket(wsUrl)

      websocket.onopen = () => {
        console.log("WebSocket connected")
        setWsConnected(true)
        setWs(websocket)
      }

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.paid) {
            onPaymentReceived()
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error)
        }
      }

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error)
        setWsConnected(false)
      }

      websocket.onclose = () => {
        console.log("WebSocket disconnected")
        setWsConnected(false)
        setWs(null)
      }

      return () => {
        websocket.close()
      }
    } catch (error) {
      console.error("Failed to establish WebSocket connection:", error)
    }
  }, [invoice, enabled, onPaymentReceived])

  return {
    isChecking,
    wsConnected,
    checkNow: checkPayment,
  }
}

