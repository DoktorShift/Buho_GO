"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWallet } from "@/context/wallet-context"
import { Shield, Lock, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"

interface PinVerifyProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PinVerify({ open, onClose, onSuccess }: PinVerifyProps) {
  const { verifyPin } = useWallet()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  const handleSubmit = () => {
    if (!pin) {
      setError("Please enter your PIN")
      return
    }

    if (verifyPin(pin)) {
      setPin("")
      setError(null)
      setAttempts(0)
      onSuccess()
      onClose()
    } else {
      setAttempts(attempts + 1)
      setError(`Incorrect PIN. ${3 - attempts} attempts remaining.`)
      setPin("")

      if (attempts >= 2) {
        // After 3 failed attempts, close the dialog
        setTimeout(() => {
          onClose()
          setAttempts(0)
        }, 1500)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl border-none shadow-lg">
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl">Enter PIN</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Enter your payment PIN
            </label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "")
                setPin(value)
                setError(null)
              }}
              className="rounded-lg text-center text-lg tracking-widest"
              autoFocus
            />
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
            disabled={!pin}
          >
            Verify
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

