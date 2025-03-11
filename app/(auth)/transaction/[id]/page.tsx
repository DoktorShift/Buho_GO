"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowDown, ArrowLeft, ArrowUp, Share2, CheckCircle, Clock, AlertCircle, Copy } from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"

type StatusInfo = {
  icon: React.ReactNode
  label: string
  color: string
}

export default function TransactionPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { state, formatBalance } = useWallet()
  const { toast } = useToast()
  const [transaction, setTransaction] = useState<any>(null)
  const [usdAmount, setUsdAmount] = useState<string>("0.00")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Helper function to get stored transactions
    const getStoredTransactions = (): Record<string, any> => {
      if (typeof window === "undefined") return {}

      try {
        const stored = localStorage.getItem("buhoGO_transactions")
        return stored ? JSON.parse(stored) : {}
      } catch (error) {
        console.error("Failed to parse stored transactions:", error)
        return {}
      }
    }

    // First try to get transaction from state
    let tx = state.history[params.id]

    // If not found in state, try to get from localStorage
    if (!tx) {
      const storedTransactions = getStoredTransactions()
      tx = storedTransactions[params.id]
    }

    if (!tx) {
      router.push("/wallet")
      return
    }

    // Make a copy of the transaction to avoid modifying the original
    const txCopy = { ...tx }

    // Ensure amount is in sats, not millisats
    // Only convert if it's not already converted
    if (txCopy.amount > 1000000) {
      // Likely in millisats if very large
      txCopy.amount = Math.floor(txCopy.amount / 1000)
    }

    if (txCopy.fees_paid > 1000) {
      // Likely in millisats if large
      txCopy.fees_paid = Math.floor(txCopy.fees_paid / 1000)
    }

    setTransaction(txCopy)

    // Calculate USD amount using current exchange rate
    const btcAmount = txCopy.amount / 100000000
    const usdValue = btcAmount * (state.exchangeRates.usd || 65000) // Use fallback value if needed
    setUsdAmount(usdValue.toFixed(2))
  }, [params.id, router, state.history, state.exchangeRates.usd])

  if (!transaction) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center py-10">
          <Clock className="h-8 w-8 text-primary/50 mx-auto mb-2 animate-pulse" />
          <p>Loading transaction...</p>
        </div>
      </div>
    )
  }

  const getStatusInfo = (): StatusInfo => {
    if (!transaction.status || transaction.status === "complete") {
      return {
        icon: <CheckCircle className="h-4 w-4" />,
        label: "Completed",
        color: "text-success",
      }
    } else if (transaction.status === "pending") {
      return {
        icon: <Clock className="h-4 w-4" />,
        label: "Pending",
        color: "text-amber-500",
      }
    } else {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        label: "Failed",
        color: "text-destructive",
      }
    }
  }

  const statusInfo = getStatusInfo()

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `Bitcoin ${transaction.type === "incoming" ? "Received" : "Sent"}`,
        text: `${transaction.type === "incoming" ? "Received" : "Sent"} ${formatBalance(transaction.amount)} - ${transaction.description}`,
      })
    } catch (error) {
      console.error("Error sharing:", error)
      toast({
        title: "Sharing Failed",
        description: "Could not share transaction details.",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    })
  }

  // Format the transaction date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="container max-w-md mx-auto p-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-6"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Transaction Details</h1>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <Share2 className="h-5 w-5" />
        </Button>
      </motion.div>

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
        <Card className="p-6 rounded-xl border-none shadow-lg">
          <div className="flex flex-col items-center mb-6">
            <div
              className={`p-4 rounded-full mb-4 ${transaction.type === "incoming" ? "bg-success/20" : "bg-primary/20"}`}
            >
              {transaction.type === "incoming" ? (
                <ArrowDown className="h-8 w-8 text-success" />
              ) : (
                <ArrowUp className="h-8 w-8 text-primary" />
              )}
            </div>

            <div className="text-center">
              <div
                className={`text-3xl font-bold mb-1 ${transaction.type === "incoming" ? "text-success" : "text-primary"}`}
              >
                {transaction.type === "incoming" ? "+" : "-"} {formatBalance(transaction.amount)}
              </div>
              <div className="text-gray-500">${usdAmount} USD</div>
              <div className={`flex items-center justify-center gap-2 mt-2 ${statusInfo.color}`}>
                {statusInfo.icon}
                <span className="text-sm font-medium">{statusInfo.label}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Date & Time</span>
              <span>{formatDate(transaction.settled_at)}</span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Description</span>
              <span className="text-right max-w-[200px] break-words">
                {transaction.description || "No description"}
              </span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Fee</span>
              <span>{formatBalance(transaction.fees_paid || 0)}</span>
            </div>

            <div className="flex justify-between items-start py-2 border-b">
              <span className="text-gray-500">Payment Hash</span>
              <div className="flex items-start gap-1">
                <span className="text-xs text-right max-w-[180px] break-all">{transaction.payment_hash}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 ml-1"
                  onClick={() => copyToClipboard(transaction.payment_hash, "Payment hash")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {transaction.preimage && (
              <div className="flex justify-between items-start py-2 border-b">
                <span className="text-gray-500">Payment Preimage</span>
                <div className="flex items-start gap-1">
                  <span className="text-xs text-right max-w-[180px] break-all">{transaction.preimage}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1"
                    onClick={() => copyToClipboard(transaction.preimage, "Preimage")}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}

