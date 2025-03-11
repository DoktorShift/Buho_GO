"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { WalletProvider, useWallet } from "@/context/wallet-context"

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { isConnected } = useWallet()
  const router = useRouter()

  useEffect(() => {
    if (!isConnected) {
      router.push("/")
    }
  }, [isConnected, router])

  if (!isConnected) {
    return null
  }

  return <>{children}</>
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WalletProvider>
      <AuthCheck>
        <main className="wallet-container">{children}</main>
      </AuthCheck>
    </WalletProvider>
  )
}

