"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  ArrowLeft,
  Plus,
  Wallet,
  ChevronRight,
  Moon,
  Sun,
  Shield,
  Trash2,
  SettingsIcon,
  CloudLightning,
} from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import { PinSetup } from "@/components/pin-setup"
import { motion } from "framer-motion"

export default function SettingsPage() {
  const router = useRouter()
  const { state, disconnectWallet, formatBalance, enablePin, getPinThreshold } = useWallet()
  const { toast } = useToast()

  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showPinSetup, setShowPinSetup] = useState(false)

  useEffect(() => {
    // Check if dark mode is enabled
    const isDark = document.documentElement.classList.contains("dark")
    setIsDarkMode(isDark)
  }, [])

  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    document.documentElement.classList.toggle("dark", newMode)
  }

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect all wallets? This action cannot be undone.")) {
      disconnectWallet()
      toast({
        title: "Wallets Disconnected",
        description: "All wallets have been disconnected successfully.",
      })
      router.push("/")
    }
  }

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  return (
    <div className="container max-w-md mx-auto p-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.push("/wallet")} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>
        <SettingsIcon className="h-5 w-5 text-primary" />
      </motion.div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Manage Wallets</h2>
            <CloudLightning className="h-5 w-5 text-primary" />
          </div>

          <div className="space-y-3">
            {state.connectedWallets.map((wallet, index) => (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
              >
                <Link href={`/settings/wallet/${wallet.id}`}>
                  <Card className="p-4 hover:shadow-md transition-all duration-200 hover:translate-y-[-2px] border-none shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Wallet className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {wallet.id === state.connectedWallets[0]?.id ? "Buho Wallet 1" : wallet.name}
                          </div>
                          <div className="text-sm text-gray-500">{formatBalance(wallet.balance)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${state.activeWalletId === wallet.id ? "bg-success" : "bg-gray-300"}`}
                        />
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>

          <Link href="/settings/connect-wallet" className="block mt-4">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-transform hover:translate-y-[-2px] shadow-sm hover:shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Connect a Wallet
            </Button>
          </Link>
        </motion.section>

        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Appearance</h2>
            {isDarkMode ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
          </div>

          <Card className="p-4 border-none shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isDarkMode ? "bg-gray-800" : "bg-yellow-100"}`}>
                  {isDarkMode ? (
                    <Moon className="h-5 w-5 text-gray-100" />
                  ) : (
                    <Sun className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <span className="font-medium">Dark Mode</span>
              </div>
              <Switch
                checked={isDarkMode}
                onCheckedChange={toggleDarkMode}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </Card>
        </motion.section>

        <motion.section variants={item}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Security</h2>
            <Shield className="h-5 w-5 text-primary" />
          </div>

          <Card className="p-4 border-none shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-medium">Require PIN for Payments</span>
                </div>
                {state.pinEnabled && (
                  <div className="text-xs text-gray-500 ml-12 mt-1">
                    Threshold: {getPinThreshold().toLocaleString()} sats
                  </div>
                )}
              </div>
              <Switch
                checked={state.pinEnabled}
                onCheckedChange={(checked) => {
                  if (checked && !state.pin) {
                    setShowPinSetup(true)
                  } else {
                    enablePin(checked)
                  }
                }}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </Card>

          {state.pinEnabled && state.pin && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Button
                variant="outline"
                className="w-full mt-3 border-primary/20 hover:bg-primary/5"
                onClick={() => setShowPinSetup(true)}
              >
                Change PIN Settings
              </Button>
            </motion.div>
          )}
        </motion.section>

        <motion.div variants={item} className="pt-4">
          <Button
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive/10 group transition-all duration-200"
            onClick={handleDisconnect}
          >
            <Trash2 className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
            Disconnect All Wallets
          </Button>
        </motion.div>
      </motion.div>

      {/* PIN Setup Dialog */}
      <PinSetup open={showPinSetup} onClose={() => setShowPinSetup(false)} />
    </div>
  )
}

