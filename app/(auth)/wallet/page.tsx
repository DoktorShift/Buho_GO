"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowDown, ArrowUp, Settings, ChevronDown, ChevronUp, RefreshCw, WalletIcon, Clock } from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import TransactionHistory from "@/components/transaction-history"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"

export default function WalletDashboard() {
  const router = useRouter()
  const { state, refreshBalance, getTransactions, switchCurrency, formatBalance, getActiveWallet } = useWallet()
  const [showHistory, setShowHistory] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()
  const activeWallet = getActiveWallet()

  // Load data only once on initial mount
  useEffect(() => {
    const initialLoad = async () => {
      // Only fetch if we haven't fetched recently (in the last minute)
      const now = Date.now()
      const lastSync = state.lastSync || 0
      const oneMinute = 60 * 1000

      if (now - lastSync > oneMinute) {
        await refreshBalance()
        await getTransactions()
      }
    }

    initialLoad()
    // No dependencies to prevent re-fetching
  }, []) // Empty dependency array

  // Handle manual refresh
  const handleManualRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      await refreshBalance(true)
      await getTransactions(true)

      toast({
        title: "Data Updated",
        description: "Your wallet data has been refreshed.",
      })
    } catch (error) {
      console.error("Refresh error:", error)
      toast({
        title: "Whoops, something went wrong",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Format the last sync time
  const formatLastSync = () => {
    if (!state.lastSync) return "Never"

    const now = new Date()
    const syncTime = new Date(state.lastSync)
    const diffMs = now.getTime() - syncTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return "Just now"
    if (diffMins === 1) return "1 minute ago"
    if (diffMins < 60) return `${diffMins} minutes ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours === 1) return "1 hour ago"
    if (diffHours < 24) return `${diffHours} hours ago`

    return syncTime.toLocaleString()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with settings */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="app-header rounded-b-xl shadow-md mb-6 bg-gradient-to-r from-primary to-primary/90"
      >
        <h1 className="text-xl font-bold">BuhoGO</h1>
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="hover:bg-white/10">
            <Settings className="h-5 w-5 text-primary-foreground" />
          </Button>
        </Link>
      </motion.div>

      {/* Balance Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-white shadow-lg mb-6 overflow-hidden rounded-xl border-none">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 pb-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <WalletIcon className="h-4 w-4 text-primary" />
                <div className="wallet-name text-sm text-gray-600">
                  {activeWallet?.id === state.connectedWallets[0]?.id
                    ? "Buho Wallet 1"
                    : activeWallet?.name || "Your Wallet"}
                </div>
              </div>
              <div
                className="balance-display cursor-pointer text-center font-bold text-3xl transition-all hover:scale-105"
                onClick={switchCurrency}
              >
                {formatBalance(state.balance)}
              </div>
              <div className="currency-display flex justify-center items-center gap-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Updated {formatLastSync()}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-primary/10"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-gray-400"}`} />
                </Button>
              </div>
            </div>
            <div className="p-3 text-center text-xs text-gray-500 border-t border-gray-100">
              Tap balance to change currency <ChevronDown className="h-3 w-3 inline-block" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-2 gap-4 mb-6"
      >
        <Link href="/receive" className="w-full">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 h-auto flex flex-col items-center gap-2 shadow-md w-full transition-transform hover:translate-y-[-2px] hover:shadow-lg">
            <div className="bg-white/20 p-2 rounded-full">
              <ArrowDown className="h-5 w-5" />
            </div>
            <span>Receive</span>
          </Button>
        </Link>

        <Link href="/send" className="w-full">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 h-auto flex flex-col items-center gap-2 shadow-md w-full transition-transform hover:translate-y-[-2px] hover:shadow-lg">
            <div className="bg-white/20 p-2 rounded-full">
              <ArrowUp className="h-5 w-5" />
            </div>
            <span>Send</span>
          </Button>
        </Link>
      </motion.div>

      {/* Transaction History Toggle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="mb-4"
      >
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-center gap-2 py-2 border-primary/20 hover:bg-primary/5"
        >
          <span className="font-medium">Transaction History</span>
          {showHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </motion.div>

      {/* Transaction History */}
      {showHistory && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-auto mb-4"
        >
          <TransactionHistory />
        </motion.div>
      )}
    </div>
  )
}

