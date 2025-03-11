"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/context/wallet-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowDown, ArrowUp, Settings, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import TransactionHistory from "@/components/transaction-history"
import SendModal from "@/components/send-modal"
import ReceiveModal from "@/components/receive-modal"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

export default function WalletInterface() {
  const { state, disconnectWallet, refreshBalance, getTransactions, switchCurrency, formatBalance } = useWallet()
  const [showSend, setShowSend] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Initial load - refresh both balance and transactions
  useEffect(() => {
    const refreshData = async () => {
      await refreshBalance()
      await getTransactions()
    }

    // Initial refresh
    refreshData()

    // Set up periodic refresh
    const interval = setInterval(refreshData, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [refreshBalance, getTransactions])

  // Manual refresh - update both balance and transactions
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshBalance()
      await getTransactions()
      toast({
        title: "Data Updated",
        description: "Your wallet balance and transactions have been refreshed.",
      })
    } catch (error) {
      console.error("Refresh error:", error)
      toast({
        title: "Refresh Failed",
        description: "Could not update wallet data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your wallet?")) {
      disconnectWallet()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with settings */}
      <div className="app-header rounded-b-xl shadow-sm mb-6">
        <h1 className="text-xl font-bold">BuhoGO</h1>
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")}>
          <Settings className="h-5 w-5 text-primary-foreground" />
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="bg-white shadow-md mb-6 overflow-hidden rounded-xl">
        <CardContent className="pt-6 pb-4">
          <div className="wallet-name">{state.nwcInfo?.wallet_pubkey ? "Connected Wallet" : "Your Wallet"}</div>
          <div className="balance-display cursor-pointer" onClick={switchCurrency}>
            {formatBalance(state.balance)}
          </div>
          <div className="currency-display flex justify-center items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            Tap to change currency <ChevronDown className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Button
          onClick={() => setShowReceive(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 h-auto flex flex-col items-center gap-2 shadow-md"
        >
          <ArrowDown className="h-6 w-6" />
          <span>Receive</span>
        </Button>

        <Button
          onClick={() => setShowSend(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 h-auto flex flex-col items-center gap-2 shadow-md"
        >
          <ArrowUp className="h-6 w-6" />
          <span>Send</span>
        </Button>
      </div>

      {/* Transaction History Toggle */}
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-center gap-2 py-2"
        >
          <span className="font-medium">Transaction History</span>
          {showHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </div>

      {/* Transaction History */}
      {showHistory && (
        <div className="flex-1 overflow-auto mb-4">
          <TransactionHistory />
        </div>
      )}

      {/* Disconnect Button */}
      <div className="mt-auto mb-4">
        <Button onClick={handleDisconnect} variant="outline" className="w-full border-gray-300">
          Disconnect Wallet
        </Button>
      </div>

      {/* Modals */}
      {showSend && <SendModal onClose={() => setShowSend(false)} />}
      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} />}
    </div>
  )
}

