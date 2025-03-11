"use client"

import { useState } from "react"
import { useWallet } from "@/context/wallet-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QrScanner } from "@/components/qr-scanner"
import { ArrowLeft, Zap, ClipboardPaste, Scan, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { decodeLnurl } from "@/lib/nwc-utils"
import { PinVerify } from "@/components/pin-verify"
// Import the new error utilities
import { getUserFriendlyErrorMessage, generateIdempotencyKey, PaymentError } from "@/lib/error-utils"
import { useRouter } from "next/navigation"

type SendModalProps = {
  onClose: () => void
}

export default function SendModal({ onClose }: SendModalProps) {
  const { payInvoice, state, formatBalance, isPinRequired } = useWallet()
  const [invoice, setInvoice] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDescription, setPaymentDescription] = useState("")
  const { toast } = useToast()
  const [showPinVerify, setShowPinVerify] = useState(false)
  const [paymentVerified, setPaymentVerified] = useState(false)
  // Add idempotency key state to prevent double payments
  const [idempotencyKey, setIdempotencyKey] = useState<string>("")
  const [paymentAttempted, setPaymentAttempted] = useState(false)
  // Add state for LNURL payment amount input
  const [lnurlData, setLnurlData] = useState<any>(null)
  const [lnurlAmount, setLnurlAmount] = useState("")
  const [showLnurlAmountInput, setShowLnurlAmountInput] = useState(false)
  // First, add a new state for tracking payment status
  // Add this with the other state declarations at the top of the component
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "pending" | "success" | "error">("idle")
  const router = useRouter()

  const handleScan = (data: string) => {
    if (data) {
      // Handle lightning: prefix
      if (data.startsWith("lightning:")) {
        data = data.substring(10)
      }

      // Handle LNURL
      if (data.startsWith("lnurl") || data.startsWith("LNURL")) {
        handleLnurl(data)
        return
      }

      setInvoice(data)

      // Simulate decoding the invoice
      setTimeout(() => {
        decodeInvoice(data)
      }, 500)
    }
  }

  const handleLnurl = async (lnurlData: string) => {
    try {
      // Decode LNURL
      const url = decodeLnurl(lnurlData)

      // Fetch LNURL data
      setIsProcessing(true)
      const response = await fetch(url)
      const data = await response.json()

      if (data.tag === "payRequest") {
        // Store LNURL data for later use
        setLnurlData(data)

        // Calculate min/max in sats
        const minSats = Math.floor(data.minSendable / 1000)
        const maxSats = Math.floor(data.maxSendable / 1000)

        // Set default amount to minimum
        setLnurlAmount(minSats.toString())

        // Show amount input dialog if min != max
        if (minSats !== maxSats) {
          setShowLnurlAmountInput(true)
          toast({
            title: "LNURL Pay",
            description: `Enter an amount between ${minSats} and ${maxSats} sats`,
          })
        } else {
          // If min == max, proceed with the payment
          await processLnurlPayment(minSats)
        }
      } else if (data.tag === "withdrawRequest") {
        // Handle withdraw request
        toast({
          title: "LNURL Withdraw",
          description: "This is a withdraw code. Please use the Receive tab instead.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Unsupported LNURL",
          description: "This type of LNURL is not supported",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("LNURL error:", error)
      toast({
        title: "LNURL Error",
        description: "Failed to process LNURL",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const processLnurlPayment = async (amountSats: number) => {
    if (!lnurlData) return

    try {
      setIsProcessing(true)

      // Convert sats to millisats for the LNURL callback
      const amountMsats = amountSats * 1000

      // Get invoice from callback
      let callbackUrl = `${lnurlData.callback}?amount=${amountMsats}`

      // Add comment if supported
      if (lnurlData.commentAllowed && lnurlData.commentAllowed > 0) {
        callbackUrl += `&comment=${encodeURIComponent("Sent from BuhoGO")}`
      }

      const invoiceResponse = await fetch(callbackUrl)
      const invoiceData = await invoiceResponse.json()

      if (invoiceData.pr) {
        // Set the invoice and payment details
        setInvoice(invoiceData.pr)
        setPaymentAmount(amountSats)
        setPaymentDescription(
          lnurlData.metadata ? extractDescription(lnurlData.metadata) : lnurlData.defaultDescription || "LNURL Payment",
        )
        setShowConfirmation(true)
        setShowLnurlAmountInput(false)
      } else if (invoiceData.error) {
        throw new Error(invoiceData.error)
      } else {
        throw new Error("No invoice returned from LNURL service")
      }
    } catch (error) {
      console.error("LNURL payment error:", error)
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to get invoice from LNURL service",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Helper function to extract description from LNURL metadata
  const extractDescription = (metadata: string): string => {
    try {
      const metadataArray = JSON.parse(metadata)
      for (const [key, value] of metadataArray) {
        if (key === "text/plain") {
          return value
        }
      }
      return "LNURL Payment"
    } catch (error) {
      return "LNURL Payment"
    }
  }

  const handleSubmit = async () => {
    if (!invoice) return

    setIsProcessing(true)
    try {
      // Try to decode the invoice to get amount and description
      let amount = 0
      let description = ""

      try {
        if (window.bolt11) {
          const decoded = window.bolt11.decode(invoice)
          amount = decoded.satoshis || 0

          // Find description tag
          for (let i = 0; i < decoded.tags.length; i++) {
            if (decoded.tags[i].tagName === "description") {
              description = decoded.tags[i].data
              break
            }
          }
        }
      } catch (error) {
        console.error("Failed to decode invoice:", error)
      }

      setPaymentAmount(amount)
      setPaymentDescription(description || "No description")
      setShowConfirmation(true)
    } catch (error) {
      console.error("Failed to parse invoice", error)
      toast({
        title: "Invalid Invoice",
        description: "The invoice could not be parsed. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Now replace the confirmPayment function with this improved version
  const confirmPayment = async () => {
    // Check if PIN is required based on amount
    if (isPinRequired(paymentAmount) && !paymentVerified) {
      setShowPinVerify(true)
      return
    }

    // Prevent double payments
    if (paymentAttempted && !confirm("A payment was already attempted. Are you sure you want to try again?")) {
      return
    }

    // Generate a new idempotency key if we don't have one
    if (!idempotencyKey) {
      setIdempotencyKey(generateIdempotencyKey())
    }

    setIsProcessing(true)
    setPaymentAttempted(true)
    setPaymentStatus("processing")

    try {
      // Store payment attempt in localStorage to track in case of app crash
      const paymentAttempt = {
        invoice,
        amount: paymentAmount,
        description: paymentDescription,
        timestamp: Date.now(),
        idempotencyKey,
      }
      localStorage.setItem(`payment_attempt_${idempotencyKey}`, JSON.stringify(paymentAttempt))

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
      localStorage.removeItem(`payment_attempt_${idempotencyKey}`)

      if (success) {
        setPaymentStatus("success")
        toast({
          title: "Payment Sent",
          description: `Successfully sent ${formatBalance(paymentAmount)}`,
        })
        onClose()
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

        // Close the modal after a short delay
        setTimeout(() => {
          onClose()
        }, 3000)
        return
      }

      // For other errors, show error state
      setPaymentStatus("error")

      // Get user-friendly error message
      const friendlyMessage = getUserFriendlyErrorMessage(error)

      // Add suggestion to check transaction history
      const errorMessage = `${friendlyMessage} If you're unsure about the payment status, please check your transaction history.`

      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
      setPaymentVerified(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInvoice(text)
    } catch (error) {
      console.error("Clipboard access denied:", error)
      toast({
        title: "Clipboard Access Denied",
        description: "Please grant clipboard permission or paste manually.",
        variant: "destructive",
      })
    }
  }

  const decodeInvoice = (invoice: string) => {
    try {
      if (window.bolt11) {
        const decoded = window.bolt11.decode(invoice)
        const amount = decoded.satoshis || 0

        // Find description tag
        let description = ""
        for (let i = 0; i < decoded.tags.length; i++) {
          if (decoded.tags[i].tagName === "description") {
            description = decoded.tags[i].data
            break
          }
        }

        setPaymentAmount(amount)
        setPaymentDescription(description || "No description")
      }
    } catch (error) {
      console.error("Failed to decode invoice:", error)
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
        {showLnurlAmountInput ? (
          // LNURL Amount Input Screen
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-xl">Enter Amount</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 px-6 pb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Amount (sats) - Min: {Math.floor(lnurlData.minSendable / 1000)}, Max:{" "}
                  {Math.floor(lnurlData.maxSendable / 1000)}
                </label>
                <Input
                  type="number"
                  placeholder="Enter amount in sats"
                  value={lnurlAmount}
                  onChange={(e) => setLnurlAmount(e.target.value)}
                  className="rounded-lg"
                />
                {lnurlData.metadata && (
                  <div className="text-sm text-gray-500 mt-2">{extractDescription(lnurlData.metadata)}</div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowLnurlAmountInput(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                  onClick={() => {
                    const amount = Number.parseInt(lnurlAmount)
                    const min = Math.floor(lnurlData.minSendable / 1000)
                    const max = Math.floor(lnurlData.maxSendable / 1000)

                    if (isNaN(amount) || amount < min || amount > max) {
                      toast({
                        title: "Invalid Amount",
                        description: `Please enter an amount between ${min} and ${max} sats`,
                        variant: "destructive",
                      })
                      return
                    }

                    processLnurlPayment(amount)
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Continue"}
                </Button>
              </div>
            </div>
          </>
        ) : !showConfirmation ? (
          // Invoice Input Screen
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-xl">Send Payment</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="scan" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-secondary/50 rounded-lg mx-6 mb-2">
                <TabsTrigger
                  value="scan"
                  className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Scan className="h-4 w-4 mr-2" />
                  Scan QR
                </TabsTrigger>
                <TabsTrigger
                  value="paste"
                  className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Paste Invoice
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="mt-0 px-6 pb-6">
                <div className="space-y-4">
                  <QrScanner onScan={handleScan} />
                  {invoice && (
                    <div className="text-xs text-gray-500 truncate bg-secondary/30 p-2 rounded-lg">{invoice}</div>
                  )}
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    disabled={!invoice || isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Continue"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="paste" className="mt-0 px-6 pb-6">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste Lightning invoice"
                      value={invoice}
                      onChange={(e) => setInvoice(e.target.value)}
                      className="w-full rounded-lg"
                    />
                    <Button variant="outline" size="icon" onClick={handlePaste}>
                      <ClipboardPaste className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                    disabled={!invoice || isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Continue"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          // Payment Confirmation Screen
          <>
            <DialogHeader className="px-6 pt-6 pb-2">
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={() => setShowConfirmation(false)} className="mr-2 -ml-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-xl">
                  {paymentStatus === "pending" ? "Payment Pending" : "Confirm Payment"}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-6 px-6 pb-6">
              {paymentStatus === "pending" ? (
                // Pending payment state with yellow/orange styling
                <div className="text-center py-6">
                  <div className="bg-amber-100 p-4 rounded-xl mb-4">
                    <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">Payment Pending</span>
                    </div>
                    <p className="text-sm text-amber-700">
                      Your payment has been sent to the network but we haven't received confirmation yet. Please check
                      your transaction history for updates.
                    </p>
                  </div>

                  <div className="text-3xl font-bold">{formatBalance(paymentAmount)}</div>
                  <div className="text-sm text-gray-500 mt-2 bg-secondary/30 p-2 rounded-lg inline-block">
                    {paymentDescription || "No description"}
                  </div>

                  <Button
                    onClick={() => router.push("/wallet")}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg mt-6"
                  >
                    View Transaction History
                  </Button>
                </div>
              ) : (
                // Normal confirmation state
                <div className="text-center py-6">
                  <div className="text-3xl font-bold">{formatBalance(paymentAmount)}</div>
                  <div className="text-sm text-gray-500 mt-2 bg-secondary/30 p-2 rounded-lg inline-block">
                    {paymentDescription || "No description"}
                  </div>
                  {isPinRequired(paymentAmount) && (
                    <div className="text-xs text-amber-500 mt-2">PIN verification required for this amount</div>
                  )}
                </div>
              )}

              {paymentStatus !== "pending" && (
                <Button
                  onClick={confirmPayment}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto"
                  disabled={isProcessing}
                >
                  <Zap className="mr-2 h-5 w-5" />
                  {isProcessing ? "Processing..." : "Pay Now"}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
      {/* PIN Verification Dialog */}
      <PinVerify
        open={showPinVerify}
        onClose={() => setShowPinVerify(false)}
        onSuccess={() => {
          setPaymentVerified(true)
          setTimeout(() => confirmPayment(), 100)
        }}
      />
    </Dialog>
  )
}

