import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import Script from "next/script"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BuhoGO - Lightning Wallet",
  description: "Mobile-enhanced Lightning wallet with NWC support",
  icons: {
    icon: "/favicon.ico",
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Load external scripts */}
        <Script src="https://bundle.run/noble-secp256k1@1.2.14" strategy="beforeInteractive" />
        <Script src="https://bundle.run/bech32@2.0.0" strategy="beforeInteractive" />
        <Script src="https://supertestnet.github.io/bitcoin-chess/js/bolt11.js" strategy="beforeInteractive" />
        <Script src="https://supertestnet.github.io/nwcjs/nwcjs.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js" strategy="beforeInteractive" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <div className="min-h-screen flex flex-col bg-background">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'