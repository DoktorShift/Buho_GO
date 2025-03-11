"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Scan, Zap, Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import { QrScanner } from "@/components/qr-scanner"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"

// Import the error utilities
import { getUserFriendlyErrorMessage, PaymentError } from "@/lib/error-utils"

enum SendStage {
  INPUT = 0,
  SCANNING = 1,
  CONFIRMATION = 2,
  SUCCESS = 3,
  ERROR = 4,
  PENDING = 5,
}

export default function SendPage() {
  const router = useRouter()
  const { payInvoice, formatBalance, state } = useWallet()
  const { toast } = useToast()

  const [stage, setStage] = useState<SendStage>(SendStage.INPUT)
  const [invoice, setInvoice] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState({
    amount: 0,
    description: "",
    destination: "",
  })
  const [error, setError] = useState("")
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "pending" | "success" | "error">("idle")

  const handleScan = (data: string) => {
    if (data) {
      if (data.startsWith("lightning:")) {
        data = data.substring(10)
      }
      setInvoice(data)
      setStage(SendStage.INPUT)

      // Simulate decoding the invoice
      setTimeout(() => {
        decodeInvoice(data)
      }, 500)
    }
  }

  const decodeInvoice = (invoiceStr: string) => {
    // In a real app, this would decode the BOLT11 invoice
    // For demo purposes, we'll simulate it
    try {
      if (window.bolt11) {
        const decoded = window.bolt11.decode(invoiceStr)
        const amount = decoded.satoshis || 10000

        // Find description tag
        let description = "Payment"
        for (let i = 0; i < decoded.tags.length; i++) {
          if (decoded.tags[i].tagName === "description") {
            description = decoded.tags[i].data
            break
          }
        }

        setPaymentDetails({
          amount: amount,
          description: description,
          destination: decoded.payeeNodeKey || "Unknown",
        })
      } else {
        // Fallback if bolt11 library is not available
        setPaymentDetails({
          amount: 10000, // 10,000 sats
          description: "Coffee at Bitcoin Cafe",
          destination: "03a...b2c",
        })
      }
    } catch (error) {
      console.error("Failed to decode invoice:", error)
      // Fallback values
      setPaymentDetails({
        amount: 10000, // 10,000 sats
        description: "Payment",
        destination: "Unknown",
      })
    }

    setStage(SendStage.CONFIRMATION)
  }

  const handleSubmit = () => {
    if (!invoice) {
      toast({
        title: "Missing Invoice",
        description: "Please enter or scan a Lightning invoice",
        variant: "destructive",
      })
      return
    }

    decodeInvoice(invoice)
  }

  const confirmPayment = async () => {
    setIsProcessing(true)
    setPaymentStatus("processing")
    try {
      // Generate a unique payment ID to track this payment
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // Store payment attempt in localStorage for recovery on app startup
      localStorage.setItem(
        paymentId,
        JSON.stringify({
          invoice,
          amount: paymentDetails.amount,
          description: paymentDetails.description,
          timestamp: Date.now(),
        }),
      )

      // Set a timeout for relay connection
      const relayTimeout = 5000 // 5 seconds
      let relayConnected = false

      // Create a promise that resolves when payment is complete or rejects on timeout
      const paymentPromise = payInvoice(invoice)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          if (!relayConnected) {
            reject(new PaymentError("Relay connection timeout", "RELAY_TIMEOUT"))
          }
        }, relayTimeout)
      })

      // Race the payment against the timeout
      const success = await Promise.race([
        paymentPromise.then((result) => {
          relayConnected = true
          return result
        }),
        timeoutPromise,
      ])

      // Remove the payment attempt from localStorage
      localStorage.removeItem(paymentId)

      if (success) {
        setPaymentStatus("success")
        setStage(SendStage.SUCCESS)

        // Return to wallet after showing success screen
        setTimeout(() => {
          router.push("/wallet")
        }, 3000)
      } else {
        throw new PaymentError("Payment failed")
      }
    } catch (error) {
      console.error("Payment failed:", error)

      // Check if it's a relay timeout error
      if (error instanceof PaymentError && error.code === "RELAY_TIMEOUT") {
        setPaymentStatus("pending")
        toast({
          title: "Payment Pending",
          description: "Payment sent but waiting for confirmation. Please check your transaction history for updates.",
          variant: "warning",
        })

        // Show pending state
        setStage(SendStage.PENDING) // You'll need to add this new stage
        return
      }

      // Get a user-friendly error message
      setError(getUserFriendlyErrorMessage(error))
      setStage(SendStage.ERROR)
      setPaymentStatus("error")
    } finally {
      setIsProcessing(false)
    }
  }

  // Calculate USD amount
  const getUsdAmount = () => {
    const btcAmount = paymentDetails.amount / 100000000
    const usdValue = btcAmount * (state.exchangeRates.usd || 65000) // Use fallback value if needed
    return usdValue.toFixed(2)
  }

  return (
    <div className="container max-w-md mx-auto p-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center mb-6"
      >
        <Button variant="ghost" size="icon" onClick={() => router.push("/wallet")} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Send Payment</h1>
      </motion.div>

      {stage === SendStage.SCANNING && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-center mb-2">Scan Invoice QR Code</h2>
                <QrScanner onScan={handleScan} onClose={() => setStage(SendStage.INPUT)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stage === SendStage.INPUT && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lightning Invoice</label>
                  <Input
                    placeholder="Paste invoice here"
                    value={invoice}
                    onChange={(e) => setInvoice(e.target.value)}
                    className="rounded-lg"
                  />
                  <p className="text-xs text-gray-500">Paste a Lightning invoice or scan a QR code</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStage(SendStage.SCANNING)}
                    className="rounded-lg border-primary/20 hover:bg-primary/5"
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    Scan QR
                  </Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    onClick={handleSubmit}
                    disabled={!invoice}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stage === SendStage.CONFIRMATION && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="text-center py-4">
                  <div className="text-3xl font-bold mb-1">{formatBalance(paymentDetails.amount)}</div>
                  <div className="text-gray-500">${getUsdAmount()}</div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Description</span>
                    <span className="text-right max-w-[200px] break-words">{paymentDetails.description}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Destination</span>
                    <span className="text-sm text-right max-w-[200px] truncate">{paymentDetails.destination}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Fee Estimate</span>
                    <span>~1 sat</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-500">Date & Time</span>
                    <span>
                      {new Date().toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto"
                  onClick={confirmPayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Pay Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stage === SendStage.SUCCESS && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
        >
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-6 flex flex-col items-center">
                <div className="bg-success/20 rounded-full p-8">
                  <CheckCircle className="h-12 w-12 text-success" />
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-bold text-success mb-2">Payment Sent!</h2>
                  <p className="text-gray-500 mb-4">Your payment was successful.</p>

                  <div className="font-bold text-2xl mb-1">{formatBalance(paymentDetails.amount)}</div>
                  <div className="text-sm text-gray-500">${getUsdAmount()}</div>
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {new Date().toLocaleString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="w-full mt-4">
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    onClick={() => router.push("/wallet")}
                  >
                    Back to Wallet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stage === SendStage.PENDING && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-6 flex flex-col items-center">
                <div className="bg-amber-100 rounded-full p-8">
                  <Clock className="h-12 w-12 text-amber-500" />
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-bold text-amber-600 mb-2">Payment Pending</h2>
                  <p className="text-gray-500 mb-4">
                    Your payment has been sent to the network but we haven't received confirmation yet. Please check
                    your transaction history for updates.
                  </p>

                  <div className="font-bold text-2xl mb-1">{formatBalance(paymentDetails.amount)}</div>
                  <div className="text-sm text-gray-500">${getUsdAmount()}</div>
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {new Date().toLocaleString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="w-full mt-4">
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    onClick={() => router.push("/wallet")}
                  >
                    View Transaction History
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {stage === SendStage.ERROR && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-6 flex flex-col items-center">
                <div className="bg-destructive/20 rounded-full p-8">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-bold text-destructive mb-2">Payment Failed</h2>
                  <p className="text-gray-500 mb-4">{error}</p>
                </div>

                <div className="w-full mt-4 grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="border-primary/20 hover:bg-primary/5 rounded-lg"
                    onClick={() => setStage(SendStage.INPUT)}
                  >
                    Try Again
                  </Button>
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    onClick={() => router.push("/wallet")}
                  >
                    Back to Wallet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

