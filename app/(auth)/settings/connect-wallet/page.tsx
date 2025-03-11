"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Wallet, Scan, Loader2, CloudLightning, LinkIcon } from "lucide-react"
import { useWallet } from "@/context/wallet-context"
import { useToast } from "@/components/ui/use-toast"
import { QrScanner } from "@/components/qr-scanner"
import { motion } from "framer-motion"

export default function ConnectWalletPage() {
  const router = useRouter()
  const { connectNewWallet } = useWallet()
  const { toast } = useToast()

  const [nwcString, setNwcString] = useState("")
  const [walletName, setWalletName] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const handleScan = (data: string) => {
    if (data) {
      setNwcString(data)
      setShowScanner(false)
    }
  }

  const handleConnect = async () => {
    if (!nwcString.trim() || !walletName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both wallet name and NWC string",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)
    try {
      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const success = await connectNewWallet(walletName.trim(), nwcString.trim())
      if (success) {
        toast({
          title: "Wallet Connected",
          description: `Successfully connected ${walletName}`,
        })
        router.push("/settings")
      } else {
        throw new Error("Connection failed")
      }
    } catch (error) {
      toast({
        title: "Whoops, something went wrong",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
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
          <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Connect Wallet</h1>
        </div>
        <CloudLightning className="h-5 w-5 text-primary" />
      </motion.div>

      {showScanner ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle>Scan NWC QR Code</CardTitle>
              <CardDescription>Scan a Nostr Wallet Connect QR code to connect your wallet</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <QrScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }}>
          <Card className="rounded-xl overflow-hidden border-none shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-full shadow-md">
                  <Wallet className="w-10 h-10 text-primary" />
                </div>
              </div>
              <CardTitle className="text-center">Add New Wallet</CardTitle>
              <CardDescription className="text-center">
                Connect a new Lightning wallet or node using NWC
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Wallet Name
                </label>
                <Input
                  placeholder="Enter wallet name"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  className="rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  NWC String
                </label>
                <Input
                  placeholder="Enter NWC string"
                  value={nwcString}
                  onChange={(e) => setNwcString(e.target.value)}
                  className="rounded-lg font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-primary/20 hover:bg-primary/5"
                    onClick={() => setShowScanner(true)}
                  >
                    <Scan className="h-3 w-3 mr-1" />
                    Scan QR
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleConnect}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto transition-transform hover:translate-y-[-2px] shadow-sm hover:shadow-md mt-4"
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

