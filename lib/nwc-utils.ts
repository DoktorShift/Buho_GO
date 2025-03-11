// Utility functions for working with Nostr Wallet Connect
import { bech32 } from "bech32"

// Type definitions for NWC
export interface NWCInfo {
  wallet_pubkey: string
  relay: string
  app_privkey: string
  app_pubkey: string
  [key: string]: string
}

export interface TransactionType {
  payment_hash: string
  amount: number
  fees_paid: number
  description: string
  type: "incoming" | "outgoing"
  settled_at: number
  detail_hidden: boolean
  invoice?: string
  bolt11?: string
  preimage?: string
  status?: "complete" | "pending" | "failed"
}

// Mock implementation of nwcjs functions for development
// In production, you would import the actual nwcjs library
export const nwcjs = {
  nwc_infos: [] as NWCInfo[],

  processNWCstring: (nwcString: string): NWCInfo | null => {
    if (!nwcString.startsWith("nostr+walletconnect://")) {
      console.error("Invalid NWC string format")
      return null
    }

    try {
      const string = nwcString.substring(22)
      const arr = string.split("&")
      arr.splice(0, 1, ...arr[0].split("?"))
      arr[0] = "wallet_pubkey=" + arr[0]

      const arr2: string[] = []
      const obj: Record<string, string> = {}

      arr.forEach((item) => arr2.push(...item.split("=")))
      arr2.forEach((item, index) => {
        if (item === "secret") arr2[index] = "app_privkey"
      })

      arr2.forEach((item, index) => {
        if (index % 2) {
          obj[arr2[index - 1]] = item
        }
      })

      // In a real implementation, this would use the actual secp256k1 library
      // For now, we'll mock this part
      obj["app_pubkey"] = "mock_app_pubkey"
      obj["relay"] = obj["relay"].replaceAll("%3A", ":").replaceAll("%2F", "/")

      // Store the NWC info for later use
      nwcjs.nwc_infos.push(obj as NWCInfo)

      return obj as NWCInfo
    } catch (error) {
      console.error("Error processing NWC string:", error)
      return null
    }
  },

  getInfo: async (nwcInfo: NWCInfo, delayTolerance = 3) => {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      result_type: "get_info",
      result: {
        alias: "NWC Wallet",
        color: "#3399ff",
        pubkey: nwcInfo.wallet_pubkey,
        network: "mainnet",
        methods: ["get_info", "get_balance", "make_invoice", "pay_invoice", "lookup_invoice", "list_transactions"],
      },
    }
  },

  getBalance: async (nwcInfo: NWCInfo, delayTolerance = 3) => {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      result_type: "get_balance",
      result: {
        balance: 1345000, // 1,345,000 sats
      },
    }
  },

  makeInvoice: async (nwcInfo: NWCInfo, amount: number, description: string, delayTolerance = 3) => {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      result_type: "make_invoice",
      result: {
        invoice:
          "lnbc10n1p3zryq3pp5xw404d0q7n6qkuzurqd8q953cz3kgkv73zrwghvzxsyf5h5zp4qdqqcqzzgxqyz5vqrzjqwnvuc0u4txn35cafc7w94gxvq5p3cu9dd95f7hlrh0fvs46wpvhdzdferjlwqzjum9ye5l8jmkv4949whjgwq4dy6rrusa4mqpgdn3e4",
        payment_hash: "fd91c21b117854fbac44ee14733f78d08f7c6db8fdae8af028d402b42b9cec7c",
      },
    }
  },

  checkInvoice: async (nwcInfo: NWCInfo, invoice: string, delayTolerance = 3) => {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      result_type: "lookup_invoice",
      result: {
        invoice: invoice,
        amount: 10000,
        description: "Test payment",
        settled_at: Math.floor(Date.now() / 1000),
        type: "incoming",
      },
    }
  },

  tryToPayInvoice: async (nwcInfo: NWCInfo, invoice: string, amount: number | null = null) => {
    // Mock implementation - just initiate the payment
    // In a real implementation, this would send the payment request to the wallet
    console.log("Attempting to pay invoice:", invoice, amount ? `with amount ${amount}` : "")
    return true
  },

  didPaymentSucceed: async (nwcInfo: NWCInfo, invoice: string, delayTolerance = 3) => {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const invoiceInfo = await nwcjs.checkInvoice(nwcInfo, invoice, delayTolerance)
    if (invoiceInfo && "result" in invoiceInfo && "preimage" in invoiceInfo.result && invoiceInfo.result.preimage) {
      return invoiceInfo.result.preimage
    }
    return false
  },

  listTransactions: async (
    nwcInfo: NWCInfo,
    from: number | null = null,
    until: number | null = null,
    limit: number | null = null,
    offset: number | null = null,
    unpaid: boolean | null = null,
    type: string | null = null,
    delayTolerance = 3,
  ) => {
    // Mock implementation
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Mock transactions
    const mockTransactions = [
      {
        payment_hash: "fd91c21b117854fbac44ee14733f78d08f7c6db8fdae8af028d402b42b9cec7c",
        amount: 1000000,
        fees_paid: 0,
        description: "Donation from Alice",
        type: "incoming",
        settled_at: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
        detail_hidden: false,
        preimage: "71b837ac51d4b0a0079607 23cc9542ad279528499c2 f90d4b7f4c934bb8ccd5e",
        status: "complete",
      },
      {
        payment_hash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        amount: 50000,
        fees_paid: 1,
        description: "Coffee at Bitcoin Cafe",
        type: "outgoing",
        settled_at: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
        detail_hidden: false,
        status: "complete",
      },
    ]

    return {
      result_type: "list_transactions",
      result: {
        transactions: mockTransactions,
      },
    }
  },
}

// Helper functions
export function getInvoicePaymentHash(invoice: string): string {
  // This would normally decode the BOLT11 invoice to get the payment hash
  // For now, we'll use a simple approach
  try {
    // This is a simplified approach - in a real implementation,
    // you would use a proper BOLT11 decoder
    const decoded = window.bolt11?.decode(invoice)
    if (decoded) {
      for (let i = 0; i < decoded.tags.length; i++) {
        if (decoded.tags[i].tagName === "payment_hash") {
          return decoded.tags[i].data.toString()
        }
      }
    }
  } catch (error) {
    console.error("Failed to decode invoice:", error)
  }

  // Fallback to a hash of the invoice itself
  return sha256(invoice)
}

export function hexToText(hex: string): string {
  const bytes = new Uint8Array(Math.ceil(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.substr(i * 2, 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

export function textToHex(text: string): string {
  const encoded = new TextEncoder().encode(text)
  return Array.from(encoded)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
}

export async function waitSomeTime(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

// Simple SHA-256 implementation for the browser
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Function to decode LNURL
export function decodeLnurl(lnurl: string): string {
  try {
    const { words } = bech32.decode(lnurl, 1023)
    const data = bech32.fromWords(words)
    return new TextDecoder().decode(new Uint8Array(data))
  } catch (error) {
    console.error("Failed to decode LNURL:", error)
    throw new Error("Invalid LNURL")
  }
}

// Add window.nwcjs type definition
declare global {
  interface Window {
    nwcjs: any
    bolt11?: any
  }
}

