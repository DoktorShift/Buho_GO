"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useWallet } from "@/context/wallet-context"
import { Shield, Lock, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

interface PinSetupProps {
  open: boolean
  onClose: () => void
}

export function PinSetup({ open, onClose }: PinSetupProps) {
  const { setPin, getPinThreshold } = useWallet()
  const { toast } = useToast()
  const [pin, setLocalPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [threshold, setThreshold] = useState(getPinThreshold().toString())
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!pin || pin.length < 4) {
      setError("PIN must be at least 4 digits")
      return
    }

    if (pin !== confirmPin) {
      setError("PINs do not match")
      return
    }

    const thresholdValue = Number.parseInt(threshold)
    if (isNaN(thresholdValue) || thresholdValue < 1) {
      setError("Please enter a valid threshold amount")
      return
    }

    setPin(pin, thresholdValue)
    toast({
      title: "PIN Set",
      description: `Your PIN has been set successfully. PIN will be required for transactions over ${thresholdValue.toLocaleString()} sats.`,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl border-none shadow-lg">
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl">Set Payment PIN</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pin" className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Enter PIN (min 4 digits)
            </Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setLocalPin(value)
                setError(null)
              }}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setConfirmPin(value)
                setError(null)
              }}
              className="rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Threshold Amount (sats)
            </Label>
            <Input
              id="threshold"
              type="number"
              inputMode="numeric"
              placeholder="Enter amount threshold"
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value)
                setError(null)
              }}
              className="rounded-lg"
            />
            <p className="text-xs text-gray-500">PIN will be required for transactions above this amount</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded-lg"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
            </motion.div>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg py-6 h-auto"
            disabled={!pin || !confirmPin || !threshold}
          >
            Set PIN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

