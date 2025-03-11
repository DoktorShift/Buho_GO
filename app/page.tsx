import { Suspense } from "react"
import WalletConnect from "@/components/wallet-connect"

export default function Home() {
  return (
    <main className="wallet-container">
      <Suspense fallback={<div className="text-center py-10">Loading...</div>}>
        <WalletConnect />
      </Suspense>
    </main>
  )
}

