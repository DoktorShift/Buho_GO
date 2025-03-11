// Simple storage utilities for wallet data

// Storage keys
export const STORAGE_KEYS = {
  WALLET_STATE: "buhoGO_wallet_state",
  TRANSACTIONS: "buhoGO_transactions",
} as const

// Clear transactions for a specific wallet
export function clearTransactions(walletId: string): void {
  if (typeof window === "undefined") return

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
    if (!stored) return

    const allTransactions = JSON.parse(stored)
    if (allTransactions[walletId]) {
      delete allTransactions[walletId]
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(allTransactions))
    }
  } catch (error) {
    console.error("Failed to clear transactions:", error)
  }
}

// Get stored transactions for a specific wallet
export function getStoredTransactions(walletId: string): Record<string, any> {
  if (typeof window === "undefined") return {}

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
    if (!stored) return {}

    const allTransactions = JSON.parse(stored)
    return allTransactions[walletId] || {}
  } catch (error) {
    console.error("Failed to parse stored transactions:", error)
    return {}
  }
}

// Store transactions for a specific wallet
export function storeTransactions(walletId: string, transactions: Record<string, any>): void {
  if (typeof window === "undefined") return

  try {
    // Get all existing transactions
    const stored = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)
    const allTransactions = stored ? JSON.parse(stored) : {}

    // Update transactions for this wallet
    allTransactions[walletId] = transactions

    // Store back to localStorage
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(allTransactions))
  } catch (error) {
    console.error("Failed to store transactions:", error)
  }
}

