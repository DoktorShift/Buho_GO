"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useWallet } from "@/context/wallet-context"
import { WalletProvider } from "@/context/wallet-context"
import { Wallet, Scan, Github, Zap, ArrowRight, CloudLightningIcon as Lightning } from "lucide-react"
import { QrScanner } from "@/components/qr-scanner"

export default function WalletConnectWrapper() {
  return (
    <WalletProvider>
      <WalletConnectInner />
    </WalletProvider>
  )
}

function WalletConnectInner() {
  const router = useRouter()
  const { isConnected, connectWallet } = useWallet()
  const [nwcString, setNwcString] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if nwcjs is loaded
  useEffect(() => {
    if (typeof window !== "undefined" && !window.nwcjs) {
      setError("NWC library not loaded. Please check your setup.")
    }
  }, [])

  // Check if already connected and redirect
  useEffect(() => {
    if (isConnected) {
      router.push("/wallet")
    }
  }, [isConnected, router])

  const handleScan = (data: string) => {
    if (data) {
      // Check if it's a valid NWC string
      if (data.startsWith("nostr+walletconnect://")) {
        setNwcString(data)
        setShowScanner(false)
        setError(null)
      } else {
        setError("Invalid QR code. Please scan a valid NWC QR code.")
      }
    }
  }

  const handleConnect = async () => {
    if (!nwcString.trim()) {
      setError("Please enter a valid NWC string")
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const success = await connectWallet(nwcString.trim())
      if (success) {
        router.push("/wallet")
      } else {
        setError("Failed to connect wallet. Please check your NWC string and try again.")
      }
    } catch (err) {
      console.error("Connection error:", err)
      setError("Whoops, something went wrong. Please try again.")
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-background to-primary/5">
      {/* Header */}
      <header className="app-header w-full rounded-b-xl shadow-sm mb-8">
        <div className="container max-w-md mx-auto px-4 py-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Lightning className="h-8 w-8 text-primary-foreground" />
            <h1 className="text-2xl font-bold mx-auto">BuhoGO</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-md mx-auto px-4 py-4 flex flex-col items-center justify-center">
        {showScanner ? (
          <Card className="w-full bg-white shadow-lg rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl">Scan NWC QR Code</CardTitle>
              <CardDescription>Scan a Nostr Wallet Connect QR code to connect your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <QrScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
              {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full bg-white shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="text-center bg-primary/10 border-b">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Connect Your Wallet</CardTitle>
              <CardDescription className="text-base mt-2">
                Link your Buho Wallet or any NWC-enabled provider
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="bg-secondary/30 rounded-lg p-3">
                  <h3 className="font-medium flex items-center gap-2 mb-1 text-sm">
                    <Zap className="h-4 w-4 text-primary" />
                    What is BuhoGO?
                  </h3>
                  <p className="text-xs text-gray-600">
                    BuhoGO is a mobile-enhanced Lightning wallet that connects to your existing Buho wallet or any
                    NWC-compatible Lightning wallet.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Enter your NWC connection string</label>
                  <div className="relative">
                    <Input
                      placeholder="nostr+walletconnect://..."
                      value={nwcString}
                      onChange={(e) => setNwcString(e.target.value)}
                      className="w-full rounded-lg border-gray-300 pr-10 focus:border-primary focus:ring-primary"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => setShowScanner(true)}
                    >
                      <Scan className="h-4 w-4" />
                    </Button>
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleConnect}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto"
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      "Connecting..."
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Connect Wallet <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>

                  <p className="text-xs text-center text-gray-500 px-4">
                    By connecting, you're accessing your wallet through NWC (Nostr Wallet Connect)
                  </p>
                </div>
              </div>
            </CardContent>

            {/* Remove the CardFooter section completely */}
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 mt-auto">
        <div className="container max-w-md mx-auto px-4 flex flex-col items-center justify-center">
          <a
            href="https://github.com/DoktorShift"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
          >
            <span>&lt;/&gt;</span>
            <span>Dr.Shift</span>
            <Github className="h-4 w-4" />
          </a>
        </div>
      </footer>
    </div>
  )
}

