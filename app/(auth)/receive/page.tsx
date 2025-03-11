"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Copy, Share2, Loader2, CheckCircle, RefreshCw, Scan, Zap } from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import { QRCode } from "@/components/qr-code"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"
import { QrScanner } from "@/components/qr-scanner"
import { decodeLnurl } from "@/lib/nwc-utils"

enum ReceiveStage {
  INPUT = 0,
  INVOICE = 1,
  PAID = 2,
}

export default function ReceivePage() {
  const router = useRouter()
  const { makeInvoice, checkInvoice, formatBalance, state } = useWallet()
  const { toast } = useToast()

  const [stage, setStage] = useState<ReceiveStage>(ReceiveStage.INPUT)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [invoice, setInvoice] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [usdAmount, setUsdAmount] = useState("0.00")
  const [copied, setCopied] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isLnurl, setIsLnurl] = useState(false)

  // Update USD amount when amount changes
  useEffect(() => {
    if (amount && !isNaN(Number(amount))) {
      const btcAmount = Number(amount) / 100000000
      const usdValue = btcAmount * (state.exchangeRates.usd || 65000) // Use fallback value if needed
      setUsdAmount(usdValue.toFixed(2))
    } else {
      setUsdAmount("0.00")
    }
  }, [amount, state.exchangeRates.usd])

  // Check if invoice is paid periodically
  useEffect(() => {
    if (stage !== ReceiveStage.INVOICE) return

    const checkPayment = async () => {
      setIsChecking(true)
      try {
        const result = await checkInvoice(invoice)
        if (result?.settled) {
          setStage(ReceiveStage.PAID)
          toast({
            title: "Payment Received",
            description: `You received ${formatBalance(Number(amount))}`,
          })

          // Return to wallet after showing success screen
          setTimeout(() => {
            router.push("/wallet")
          }, 3000)
        }
      } finally {
        setIsChecking(false)
      }
    }

    checkPayment()
    const interval = setInterval(checkPayment, 3000)
    return () => clearInterval(interval)
  }, [stage, invoice, checkInvoice, amount, formatBalance, router, toast])

  // Update the handleScanLnurl function
  const handleScanLnurl = (data: string) => {
    if (!data) return

    if (data && (data.startsWith("lnurl") || data.startsWith("LNURL"))) {
      setAmount(data)
      setShowScanner(false)
      setIsLnurl(true)
      handleGenerate(data)
    } else {
      toast({
        title: "Invalid LNURL",
        description: "The scanned QR code is not a valid LNURL withdraw code.",
        variant: "destructive",
      })
    }
  }

  const handleGenerate = async (lnurlData?: string) => {
    const inputAmount = lnurlData || amount

    if (
      !inputAmount ||
      (isNaN(Number(inputAmount)) && !inputAmount.startsWith("lnurl") && !inputAmount.startsWith("LNURL"))
    ) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount in sats",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      // Handle LNURL withdraw
      if (inputAmount.startsWith("lnurl") || inputAmount.startsWith("LNURL")) {
        try {
          const url = decodeLnurl(inputAmount)
          const response = await fetch(url)
          const data = await response.json()

          if (data.tag !== "withdrawRequest") {
            toast({
              title: "Invalid LNURL",
              description: "This is not a withdraw code. Please use the Send tab for pay codes.",
              variant: "destructive",
            })
            return
          }

          // Generate invoice for the minimum amount
          const minAmount = Math.floor(data.minWithdrawable / 1000)
          setAmount(minAmount.toString())

          const generatedInvoice = await makeInvoice(minAmount, data.defaultDescription || "LNURL Withdraw")
          if (generatedInvoice) {
            setInvoice(generatedInvoice)
            setStage(ReceiveStage.INVOICE)

            // Submit the invoice to the LNURL service
            const callbackUrl = `${data.callback}?k1=${data.k1}&pr=${encodeURIComponent(generatedInvoice)}`
            await fetch(callbackUrl)
          }
        } catch (error) {
          console.error("LNURL error:", error)
          toast({
            title: "LNURL Error",
            description: "Failed to process LNURL withdraw",
            variant: "destructive",
          })
        }
      } else {
        // Regular invoice generation
        const generatedInvoice = await makeInvoice(Number(amount), description || "BuhoGO Payment")
        if (generatedInvoice) {
          setInvoice(generatedInvoice)
          setStage(ReceiveStage.INVOICE)
        }
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error)
      toast({
        title: "Generation Failed",
        description: "Could not generate invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(invoice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    toast({
      title: "Copied",
      description: "Invoice copied to clipboard",
    })
  }

  const shareInvoice = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Lightning Invoice",
          text: invoice,
        })
      } catch (error) {
        console.error("Error sharing:", error)
      }
    } else {
      copyToClipboard()
    }
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
        <h1 className="text-xl font-semibold">Receive Payment</h1>
      </motion.div>

      {showScanner ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-center">Scan LNURL Withdraw Code</h2>
                <QrScanner onScan={handleScanLnurl} onClose={() => setShowScanner(false)} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardContent className="p-6">
              {stage === ReceiveStage.INPUT && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount (sats) or LNURL withdraw code</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Enter amount or LNURL"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value)
                          setIsLnurl(e.target.value.startsWith("lnurl") || e.target.value.startsWith("LNURL"))
                        }}
                        className="rounded-lg"
                      />
                      <Button variant="outline" size="icon" onClick={() => setShowScanner(true)}>
                        <Scan className="h-4 w-4" />
                      </Button>
                    </div>
                    {amount && !isNaN(Number(amount)) && (
                      <p className="text-xs text-gray-500 text-right">≈ ${usdAmount} USD</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Input
                      placeholder="What's this payment for?"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-lg"
                      disabled={isLnurl}
                    />
                  </div>

                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto"
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || (!amount && !isLnurl)}
                  >
                    {isGenerating ? (
                      <div className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isLnurl ? "Processing LNURL..." : "Generating..."}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Zap className="mr-2 h-5 w-5" />
                        {isLnurl ? "Process LNURL Withdraw" : "Generate Invoice"}
                      </div>
                    )}
                  </Button>
                </div>
              )}

              {stage === ReceiveStage.INVOICE && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-1">{formatBalance(Number(amount))}</div>
                    <div className="text-gray-500">${usdAmount} USD</div>

                    <div className="text-sm text-gray-500 flex items-center justify-center gap-2 mt-4">
                      <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin text-primary" : ""}`} />
                      Waiting for payment...
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="qr-container border-2 border-primary/20 rounded-xl shadow-sm p-4 bg-white">
                      <QRCode value={invoice} size={200} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={shareInvoice}
                      className="rounded-lg border-primary/20 hover:bg-primary/5"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      onClick={copyToClipboard}
                      className="rounded-lg border-primary/20 hover:bg-primary/5"
                    >
                      {copied ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-success" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {stage === ReceiveStage.PAID && (
                <div className="space-y-6 flex flex-col items-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                    className="bg-success/20 rounded-full p-8"
                  >
                    <CheckCircle className="h-12 w-12 text-success" />
                  </motion.div>

                  <div className="text-center">
                    <h2 className="text-xl font-bold text-success mb-2">Payment Received!</h2>
                    <p className="text-gray-500 mb-4">Payment was successfully received.</p>

                    <div className="font-bold text-2xl mb-1">{formatBalance(Number(amount))}</div>
                    <div className="text-sm text-gray-500">${usdAmount} USD</div>
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
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

