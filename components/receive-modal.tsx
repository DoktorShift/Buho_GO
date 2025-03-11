"use client"

import { useState } from "react"
import { useWallet } from "@/context/wallet-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QRCode } from "@/components/qr-code"
import { Copy, Share2, Loader2, CheckCircle, Scan, RefreshCw } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { decodeLnurl } from "@/lib/nwc-utils"
import { QrScanner } from "@/components/qr-scanner"
import { usePaymentDetection } from "@/hooks/use-payment-detection"

type ReceiveModalProps = {
  onClose: () => void
}

export default function ReceiveModal({ onClose }: ReceiveModalProps) {
  const { makeInvoice, checkInvoice, state, formatBalance } = useWallet()
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [invoice, setInvoice] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [isLnurl, setIsLnurl] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const { toast } = useToast()

  // Check if invoice is paid periodically
  // useEffect(() => {
  //   if (!invoice || isPaid) return

  //   const checkPayment = async () => {
  //     const result = await checkInvoice(invoice)
  //     if (result?.result?.settled_at) {
  //       setIsPaid(true)
  //       toast({
  //         title: "Payment Received",
  //         description: `You received ${formatBalance(Number.parseInt(amount))}`,
  //       })
  //       setTimeout(() => {
  //         onClose()
  //       }, 2000)
  //     }
  //   }

  //   checkPayment()
  //   const interval = setInterval(checkPayment, 3000)
  //   return () => clearInterval(interval)
  // }, [invoice, isPaid, checkInvoice, amount, formatBalance, onClose, toast])

  const { isChecking, wsConnected } = usePaymentDetection({
    invoice,
    onPaymentReceived: () => {
      setIsPaid(true)
      toast({
        title: "Payment Received",
        description: `You received ${formatBalance(Number.parseInt(amount))}`,
      })
      setTimeout(() => {
        onClose()
      }, 2000)
    },
    enabled: Boolean(invoice) && !isPaid,
  })

  const handleScanLnurl = (data: string) => {
    if (data && (data.startsWith("lnurl") || data.startsWith("LNURL"))) {
      setAmount(data)
      setShowScanner(false)
    } else {
      toast({
        title: "Invalid LNURL",
        description: "The scanned QR code is not a valid LNURL withdraw code.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateInvoice = async () => {
    if (!amount || isNaN(Number.parseInt(amount))) {
      // Check if it's an LNURL withdraw code
      if (amount && (amount.startsWith("lnurl") || amount.startsWith("LNURL"))) {
        handleLnurlWithdraw(amount)
        return
      }

      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount in sats.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const generatedInvoice = await makeInvoice(Number.parseInt(amount), description || "BuhoGO Payment")
      if (generatedInvoice) {
        setInvoice(generatedInvoice)
      } else {
        throw new Error("Failed to generate invoice")
      }
    } catch (error) {
      console.error("Failed to generate invoice", error)
      toast({
        title: "Invoice Generation Failed",
        description: "Could not generate an invoice. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleLnurlWithdraw = async (lnurlData: string) => {
    try {
      setIsLnurl(true)
      setIsGenerating(true)

      // Decode LNURL
      const url = decodeLnurl(lnurlData)

      // Fetch LNURL data
      const response = await fetch(url)
      const data = await response.json()

      if (data.tag !== "withdrawRequest") {
        toast({
          title: "Invalid LNURL",
          description: "This is not a withdraw code. Please use the Send tab for pay codes.",
          variant: "destructive",
        })
        setIsLnurl(false)
        setIsGenerating(false)
        return
      }

      // Generate invoice for the minimum amount
      const minAmount = Math.floor(data.minWithdrawable / 1000)
      const maxAmount = Math.floor(data.maxWithdrawable / 1000)

      // Use the minimum amount for simplicity
      const withdrawAmount = minAmount
      setAmount(withdrawAmount.toString())

      const generatedInvoice = await makeInvoice(withdrawAmount, data.defaultDescription || "LNURL Withdraw")

      if (!generatedInvoice) {
        throw new Error("Failed to generate invoice")
      }

      setInvoice(generatedInvoice)

      // Submit the invoice to the LNURL service
      const callbackUrl = `${data.callback}?k1=${data.k1}&pr=${encodeURIComponent(generatedInvoice)}`
      const withdrawResponse = await fetch(callbackUrl)
      const withdrawResult = await withdrawResponse.json()

      if (withdrawResult.status !== "OK") {
        throw new Error("Withdraw request failed")
      }

      toast({
        title: "Withdraw Request Sent",
        description: "Waiting for payment...",
      })
    } catch (error) {
      console.error("LNURL withdraw error:", error)
      toast({
        title: "Withdraw Failed",
        description: "Failed to process LNURL withdraw",
        variant: "destructive",
      })
      setInvoice("")
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(invoice)
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
        console.error("Error sharing", error)
      }
    } else {
      copyToClipboard()
    }
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl">Receive Payment</DialogTitle>
        </DialogHeader>

        {showScanner ? (
          <div className="px-6 pb-6">
            <QrScanner onScan={handleScanLnurl} onClose={() => setShowScanner(false)} />
          </div>
        ) : !invoice ? (
          <div className="space-y-4 px-6 pb-6">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (sats) or LNURL withdraw code</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  placeholder="Enter amount in sats or paste LNURL withdraw code"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-lg flex-1"
                />
                <Button variant="outline" size="icon" onClick={() => setShowScanner(true)}>
                  <Scan className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="What's this payment for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-lg"
              />
            </div>

            <Button
              onClick={handleGenerateInvoice}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg mt-4"
              disabled={!amount || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLnurl ? "Processing Withdraw..." : "Generating..."}
                </>
              ) : (
                "Generate Invoice"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 px-6 pb-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{formatBalance(Number.parseInt(amount))}</div>
              {isPaid ? (
                <div className="text-success font-medium mt-2 flex items-center justify-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Payment Received!
                </div>
              ) : (
                <div className="text-sm text-gray-500 flex items-center justify-center gap-2 mt-4">
                  <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
                  {wsConnected ? <>Connected • Waiting for payment...</> : <>Checking payment status...</>}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <div className="qr-container border-2 border-primary/20 rounded-xl shadow-sm">
                <QRCode value={invoice} size={200} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={copyToClipboard} className="flex-1" variant="outline">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button onClick={shareInvoice} className="flex-1" variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

