"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@/context/wallet-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowUp, ChevronRight, RefreshCw, Clock, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { motion } from "framer-motion"

export default function TransactionHistory() {
  const router = useRouter()
  const { state, formatBalance, getTransactions } = useWallet()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Handle manual refresh
  const handleManualRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      // Force refresh transactions - this will clear old data first
      await getTransactions(true)

      toast({
        title: "Transactions Updated",
        description: "Your transaction history has been refreshed.",
      })
    } catch (error) {
      console.error("Failed to refresh transactions:", error)
      toast({
        title: "Whoops, something went wrong",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Convert history object to array and sort by date
  const transactions = Object.entries(state.history)
    .map(([id, tx]) => {
      // Make sure we're working with a copy, not the original
      return {
        id,
        ...tx,
        // Ensure amount is in sats, not millisats
        amount: tx.amount || 0,
        fees_paid: tx.fees_paid || 0,
      }
    })
    .sort((a, b) => b.settled_at - a.settled_at)

  // Format date for transactions
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  if (state.isLoadingTransactions) {
    return (
      <Card className="bg-white shadow-sm rounded-xl border-none">
        <CardContent className="p-4 text-center text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            <span>Loading transactions...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card className="bg-white shadow-sm rounded-xl border-none">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center gap-3 py-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <AlertCircle className="h-6 w-6 text-primary" />
            </div>
            <p className="text-gray-600">No transactions yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              className="text-xs mt-2 border-primary/20"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Group transactions by date
  const groupedTransactions: Record<string, typeof transactions> = {}

  transactions.forEach((tx) => {
    const date = new Date(tx.settled_at * 1000).toDateString()
    if (!groupedTransactions[date]) {
      groupedTransactions[date] = []
    }
    groupedTransactions[date].push(tx)
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-600">Recent Activity</h3>
        <Button variant="ghost" size="sm" onClick={handleManualRefresh} className="text-xs h-8" disabled={isRefreshing}>
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          Refresh
        </Button>
      </div>

      {Object.entries(groupedTransactions).map(([date, txs], groupIndex) => (
        <div key={date} className="space-y-2">
          <div className="text-xs text-gray-500 px-2">
            {new Date(date).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </div>

          <Card className="bg-white shadow-sm rounded-xl overflow-hidden border-none">
            {txs.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 + groupIndex * 0.1, duration: 0.3 }}
              >
                <Link href={`/transaction/${tx.id}`}>
                  <div
                    className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors ${index !== 0 ? "border-t border-gray-100" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${tx.type === "incoming" ? "bg-success/20" : "bg-primary/20"}`}>
                        {tx.type === "incoming" ? (
                          <ArrowDown className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowUp className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{tx.type === "incoming" ? "Received" : "Sent"}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(tx.settled_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`font-medium ${tx.type === "incoming" ? "text-success" : "text-primary"}`}>
                        {tx.type === "incoming" ? "+" : "-"} {formatBalance(tx.amount)}
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}

