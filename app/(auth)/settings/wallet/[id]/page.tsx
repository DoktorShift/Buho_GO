"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Trash2, Copy, RefreshCw, CheckCircle, Wallet, Clock } from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"

export default function WalletDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { removeWallet, state, formatBalance, switchWallet, refreshBalance, getTransactions } = useWallet()
  const { toast } = useToast()

  const [wallet, setWallet] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Get wallet from context
    const foundWallet = state.connectedWallets.find((w) => w.id === params.id)
    if (!foundWallet) {
      router.push("/settings")
      return
    }

    setWallet(foundWallet)
  }, [params.id, router, state.connectedWallets])

  const handleRefresh = async () => {
    setIsRefreshing(true)

    // First switch to this wallet if it's not the active one
    if (state.activeWalletId !== wallet.id) {
      switchWallet(wallet.id)
    }

    // Then refresh balance and transactions
    try {
      // Wait a bit for the wallet switch to complete
      await new Promise((resolve) => setTimeout(resolve, 500))
      await refreshBalance()
      await getTransactions()

      toast({
        title: "Wallet Refreshed",
        description: "Wallet information has been updated.",
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

  const handleCopyNWC = () => {
    if (!wallet) return

    navigator.clipboard.writeText(wallet.nwcString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)

    toast({
      title: "Copied",
      description: "NWC string copied to clipboard",
    })
  }

  const handleSetActive = () => {
    if (!wallet) return

    switchWallet(wallet.id)
    toast({
      title: "Wallet Activated",
      description: `${wallet.name} is now your active wallet.`,
    })
    router.push("/wallet")
  }

  const handleRemoveWallet = () => {
    if (!wallet) return

    if (confirm(`Are you sure you want to remove ${wallet.name}?`)) {
      removeWallet(wallet.id)
      toast({
        title: "Wallet Removed",
        description: `${wallet.name} has been removed.`,
      })
      router.push("/settings")
    }
  }

  if (!wallet) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center py-10">
          <Clock className="h-8 w-8 text-primary/50 mx-auto mb-2 animate-pulse" />
          <p>Loading wallet details...</p>
        </div>
      </div>
    )
  }

  const isActive = state.activeWalletId === wallet.id

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
    <div className="container max-w-md mx-auto p-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center mb-6"
      >
        <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} className="mr-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <span>{wallet.name}</span>
          {isActive && (
            <span className="bg-success/20 text-success text-xs px-2 py-0.5 rounded-full flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" /> Active
            </span>
          )}
        </h1>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <Card className="p-6 rounded-xl border-none shadow-lg overflow-hidden">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-500 font-medium">Status</span>
              <span className={`flex items-center gap-2 ${isActive ? "text-success" : "text-gray-500"}`}>
                <span className={`h-2 w-2 rounded-full ${isActive ? "bg-success" : "bg-gray-300"}`} />
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-500 font-medium">Balance</span>
              <span className="font-medium">{formatBalance(wallet.balance)}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b">
              <span className="text-gray-500 font-medium">Last Synced</span>
              <div className="flex items-center gap-2">
                <span>{formatLastSync()}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-primary/10 rounded-full"
                  onClick={handleRefresh}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-primary" : "text-gray-400"}`} />
                </Button>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500 font-medium">NWC Connection String</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-primary/10 rounded-full"
                  onClick={handleCopyNWC}
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg">
                <p className="text-xs break-all font-mono">{wallet.nwcString}</p>
              </div>
            </div>
          </div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="space-y-3"
        >
          {!isActive && (
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto transition-transform hover:translate-y-[-2px] shadow-sm hover:shadow-md"
              onClick={handleSetActive}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Set as Active Wallet
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive/10 group transition-all duration-200"
            onClick={handleRemoveWallet}
          >
            <Trash2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
            Remove Wallet
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}

