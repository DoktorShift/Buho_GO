"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { toast } from "@/components/ui/use-toast"
import { getInvoicePaymentHash, type NWCInfo, type TransactionType } from "@/lib/nwc-utils"
import { getStoredTransactions, storeTransactions, clearTransactions } from "@/lib/wallet-storage"
// Import the new error utilities
import { categorizeError, NetworkError, PaymentError, WalletConnectionError } from "@/lib/error-utils"

// Storage key for wallet state
const WALLET_STATE_KEY = "buhoGO_wallet_state"

type Transaction = TransactionType

type WalletData = {
  id: string
  name: string
  nwcString: string
  balance: number
  nwcInfo: NWCInfo | null
}

// Update WalletState to include PIN threshold
type WalletState = {
  nwcString: string | null
  nwcInfo: NWCInfo | null
  balance: number
  history: Record<string, Transaction>
  currency: string
  currencies: string[]
  exchangeRates: Record<string, number>
  lastSync: number
  connectedWallets: WalletData[]
  activeWalletId: string | null
  pinEnabled: boolean
  pin: string | null
  pinThreshold: number // New field for PIN threshold
  isLoadingTransactions: boolean
  isLoadingBalance: boolean
}

// Update WalletContextType to include PIN threshold functions
type WalletContextType = {
  state: WalletState
  isConnected: boolean
  connectWallet: (nwcString: string) => Promise<boolean>
  disconnectWallet: () => void
  refreshBalance: (forceRefresh?: boolean) => Promise<void>
  getTransactions: (forceRefresh?: boolean) => Promise<void>
  makeInvoice: (amount: number, description: string) => Promise<string | null>
  payInvoice: (invoice: string) => Promise<boolean>
  checkInvoice: (invoice: string) => Promise<any>
  switchCurrency: () => void
  formatBalance: (amount: number) => string
  formatCurrency: (amount: number) => string
  connectNewWallet: (name: string, nwcString: string) => Promise<boolean>
  switchWallet: (walletId: string) => void
  removeWallet: (walletId: string) => void
  getActiveWallet: () => WalletData | null
  setPin: (pin: string, threshold: number) => void // Updated to include threshold
  enablePin: (enabled: boolean) => void
  verifyPin: (pin: string) => boolean
  isPinEnabled: () => boolean
  isPinRequired: (amount: number) => boolean // New function to check if PIN is required
  getPinThreshold: () => number // New function to get PIN threshold
  setPinThreshold: (threshold: number) => void // New function to set PIN threshold
}

// Update defaultState to include PIN threshold
const defaultState: WalletState = {
  nwcString: null,
  nwcInfo: null,
  balance: 0,
  history: {},
  currency: "sats",
  currencies: ["sats", "btc", "usd"],
  exchangeRates: {
    usd: 65000, // Default fallback BTC price in USD
  },
  lastSync: 0,
  connectedWallets: [],
  activeWalletId: null,
  pinEnabled: false,
  pin: null,
  pinThreshold: 10000, // Default threshold: 10,000 sats
  isLoadingTransactions: false,
  isLoadingBalance: false,
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(() => {
    // Load from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(WALLET_STATE_KEY)
      if (saved) {
        try {
          const parsedState = JSON.parse(saved)

          // Get the active wallet ID
          const activeWalletId = parsedState.activeWalletId

          // If we have an active wallet, load its transactions
          let transactions = {}
          if (activeWalletId) {
            transactions = getStoredTransactions(activeWalletId)
          }

          return {
            ...parsedState,
            // Load transactions for active wallet
            history: transactions,
            // Ensure pinThreshold exists (for backward compatibility)
            pinThreshold: parsedState.pinThreshold || defaultState.pinThreshold,
            // Reset loading states
            isLoadingTransactions: false,
            isLoadingBalance: false,
          }
        } catch (e) {
          console.error("Failed to parse saved wallet state", e)
        }
      }
    }
    return defaultState
  })

  // Make sure the isConnected check is correct
  const isConnected = Boolean(state.nwcString || (state.connectedWallets && state.connectedWallets.length > 0))

  // Save state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Create a copy without the history (we store that separately)
      const stateToSave = { ...state, history: {} }
      localStorage.setItem(WALLET_STATE_KEY, JSON.stringify(stateToSave))
    }
  }, [state])

  // Fetch current exchange rates
  const fetchExchangeRates = async (): Promise<void> => {
    try {
      // Use CoinGecko API to get current BTC price in USD
      const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")

      if (!response.ok) {
        console.log("Exchange rate API returned an error, using cached rates")
        return
      }

      const data = await response.json()

      if (data && data.bitcoin && data.bitcoin.usd) {
        setState((prev) => ({
          ...prev,
          exchangeRates: {
            ...prev.exchangeRates,
            usd: data.bitcoin.usd,
          },
        }))
        console.log("Updated exchange rate: 1 BTC =", data.bitcoin.usd, "USD")
      }
    } catch (error) {
      console.error("Failed to fetch exchange rates:", error)
      // Keep using the existing rate, don't show an error to the user
    }
  }

  // Fetch exchange rates on mount and less frequently (every hour instead of 15 minutes)
  useEffect(() => {
    // Fetch immediately on mount only if we haven't fetched recently
    const now = Date.now()
    const lastRatesFetch = localStorage.getItem("buhoGO_rates_last_fetch")
    const lastFetchTime = lastRatesFetch ? Number.parseInt(lastRatesFetch) : 0
    const oneHour = 60 * 60 * 1000

    if (now - lastFetchTime > oneHour) {
      fetchExchangeRates()
      localStorage.setItem("buhoGO_rates_last_fetch", now.toString())
    }

    // Then fetch every hour instead of every 15 minutes
    const interval = setInterval(() => {
      fetchExchangeRates()
      localStorage.setItem("buhoGO_rates_last_fetch", Date.now().toString())
    }, oneHour)

    return () => clearInterval(interval)
  }, [])

  // Check for pending payments on startup
  useEffect(() => {
    const checkPendingPayments = async () => {
      if (!isConnected || !state.nwcInfo || !window.nwcjs) return

      try {
        // Look for payment attempts in localStorage
        const pendingPayments: Record<string, any> = {}

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith("payment_attempt_")) {
            try {
              const paymentData = JSON.parse(localStorage.getItem(key) || "{}")
              pendingPayments[key] = paymentData
            } catch (e) {
              console.error("Failed to parse pending payment data", e)
            }
          }
        }

        // If we have pending payments, check their status
        const pendingKeys = Object.keys(pendingPayments)
        if (pendingKeys.length > 0) {
          console.log(`Found ${pendingKeys.length} pending payments to check`)

          for (const key of pendingKeys) {
            const payment = pendingPayments[key]
            if (!payment.invoice) continue

            try {
              console.log(`Checking status of pending payment: ${key}`)
              const delay_tolerance = 5
              const preimage = await window.nwcjs.didPaymentSucceed(state.nwcInfo, payment.invoice, delay_tolerance)

              if (preimage) {
                console.log(`Payment ${key} was successful, removing from pending`)
                localStorage.removeItem(key)
              } else {
                console.log(`Payment ${key} status unknown, keeping as pending`)
                // Keep it for now, might need manual resolution
              }
            } catch (error) {
              console.error(`Error checking pending payment ${key}:`, error)
            }
          }

          // Refresh balance and transactions after checking pending payments
          await refreshBalance()
          await getTransactions(true)
        }
      } catch (error) {
        console.error("Error checking pending payments:", error)
      }
    }

    // Run the check when the wallet connects
    if (isConnected) {
      checkPendingPayments()
    }
  }, [isConnected])

  // Connect wallet using NWC string
  const connectWallet = async (nwcString: string): Promise<boolean> => {
    try {
      if (!window.nwcjs) {
        toast({
          title: "NWC Library Missing",
          description: "The nwcjs library is not loaded. Please check your setup.",
          variant: "destructive",
        })
        return false
      }

      // Process the NWC string to get connection info
      const nwcInfo = window.nwcjs.processNWCstring(nwcString)

      if (!nwcInfo) {
        toast({
          title: "Connection Failed",
          description: "Invalid NWC string. Please check and try again.",
          variant: "destructive",
        })
        return false
      }

      // Create a new wallet entry
      const newWallet: WalletData = {
        id: crypto.randomUUID(),
        name: "NWC Wallet",
        nwcString,
        balance: 0,
        nwcInfo,
      }

      // Update state with the new wallet
      setState((prev) => ({
        ...prev,
        nwcString,
        nwcInfo,
        connectedWallets: [newWallet],
        activeWalletId: newWallet.id,
      }))

      // Fetch initial balance and transactions
      await refreshBalance()
      await getTransactions(true)

      return true
    } catch (error) {
      console.error("Failed to connect wallet", error)
      toast({
        title: "Connection Failed",
        description: "Could not connect to your wallet. Please try again.",
        variant: "destructive",
      })
      return false
    }
  }

  const disconnectWallet = () => {
    // Clear all wallet data from localStorage
    if (state.activeWalletId) {
      clearTransactions(state.activeWalletId)
    }

    setState(defaultState)

    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    })
  }

  // Enhance the refreshBalance function with better error handling
  const refreshBalance = async (forceRefresh = false): Promise<void> => {
    if (!isConnected || !state.nwcInfo || !window.nwcjs) return

    try {
      setState((prev) => ({
        ...prev,
        isLoadingBalance: true,
      }))

      const delay_tolerance = 5
      const balance_info = await window.nwcjs.getBalance(state.nwcInfo, delay_tolerance)

      if (balance_info === "timed out") {
        throw new NetworkError("Balance update timed out")
      }

      if ("error" in balance_info && balance_info.error) {
        throw new Error(`Balance update error: ${JSON.stringify(balance_info.error)}`)
      }

      if (
        typeof balance_info === "object" &&
        "result" in balance_info &&
        balance_info.result &&
        "balance" in balance_info.result
      ) {
        // Divide by 1000 to convert from millisats to sats
        const balanceInSats = Math.floor(balance_info.result.balance / 1000)

        setState((prev) => ({
          ...prev,
          balance: balanceInSats,
          lastSync: Date.now(),
          isLoadingBalance: false,
        }))

        console.log("Updated balance:", balanceInSats)

        // Update the wallet in the connectedWallets array
        if (state.activeWalletId) {
          setState((prev) => {
            const updatedWallets = prev.connectedWallets.map((wallet) => {
              if (wallet.id === prev.activeWalletId) {
                return { ...wallet, balance: balanceInSats }
              }
              return wallet
            })

            return { ...prev, connectedWallets: updatedWallets }
          })
        }
      }
    } catch (error) {
      console.error("Failed to refresh balance", error)

      setState((prev) => ({
        ...prev,
        isLoadingBalance: false,
      }))

      if (forceRefresh) {
        const categorizedError = categorizeError(error)

        if (categorizedError instanceof NetworkError) {
          toast({
            title: "Network Error",
            description: "Could not update balance due to network issues. Please check your connection.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Balance Update Failed",
            description: "Could not update wallet balance. Please try again.",
            variant: "destructive",
          })
        }
      }

      throw categorizeError(error)
    }
  }

  // Completely redesigned getTransactions function with robust caching and error handling
  const getTransactions = async (forceRefresh = false): Promise<void> => {
    if (!isConnected || !state.nwcInfo || !window.nwcjs || !state.activeWalletId) return

    // If this is a manual refresh, clear the old data first
    if (forceRefresh && state.activeWalletId) {
      // Clear transactions from state
      setState((prev) => ({
        ...prev,
        history: {},
      }))

      // Clear from storage
      clearTransactions(state.activeWalletId)
    }

    try {
      const delay_tolerance = 5
      const until = Math.floor(Date.now() / 1000)
      const limit = 20

      console.log(`Fetching transactions for wallet: ${state.activeWalletId}${forceRefresh ? " (forced refresh)" : ""}`)

      const txs_response = await window.nwcjs.listTransactions(
        state.nwcInfo,
        null,
        until,
        limit,
        null,
        null,
        null,
        delay_tolerance,
      )

      if (txs_response === "timed out") {
        console.error("Transaction fetch timed out")
        if (forceRefresh) {
          toast({
            title: "Whoops, something went wrong",
            description: "Please try again",
            variant: "destructive",
          })
        }
        return
      }

      if ("error" in txs_response && txs_response.error) {
        console.error("Error fetching transactions:", txs_response.error)
        if (forceRefresh) {
          toast({
            title: "Whoops, something went wrong",
            description: "Please try again",
            variant: "destructive",
          })
        }
        return
      }

      if (txs_response?.result?.transactions) {
        const txs = txs_response.result.transactions
        const txs_found: Record<string, Transaction> = {}

        txs.forEach((new_tx: Transaction) => {
          new_tx.detail_hidden = true

          if (new_tx.amount) {
            new_tx.amount = Math.floor(new_tx.amount / 1000)
          }

          if (new_tx.fees_paid) {
            new_tx.fees_paid = Math.floor(new_tx.fees_paid / 1000)
          }

          if (!new_tx.payment_hash && (new_tx.invoice || new_tx.bolt11)) {
            new_tx.payment_hash = getInvoicePaymentHash(new_tx.invoice || new_tx.bolt11 || "")
          }

          if (new_tx.payment_hash) {
            txs_found[new_tx.payment_hash] = new_tx
          }
        })

        if (Object.keys(txs_found).length) {
          // Store transactions in localStorage for this wallet
          storeTransactions(state.activeWalletId, txs_found)

          // Update state
          setState((prev) => ({
            ...prev,
            history: txs_found,
            lastSync: Date.now(),
          }))

          console.log("Updated transaction history with", Object.keys(txs_found).length, "transactions")
        } else {
          console.log("No new transactions found")
          // Even if no new transactions were found, update the lastSync timestamp
          setState((prev) => ({
            ...prev,
            lastSync: Date.now(),
          }))
        }
      }
    } catch (error) {
      console.error("Failed to get transactions:", error)
      if (forceRefresh) {
        toast({
          title: "Whoops, something went wrong",
          description: "Please try again",
          variant: "destructive",
        })
      }
    }
  }

  // Enhance the payInvoice function with better error handling
  const payInvoice = async (invoice: string): Promise<boolean> => {
    if (!isConnected || !state.nwcInfo || !window.nwcjs) {
      throw new WalletConnectionError("Wallet not connected")
    }

    try {
      // Check if we have sufficient balance before attempting payment
      const decodedInvoice = window.bolt11?.decode(invoice)
      if (decodedInvoice && decodedInvoice.satoshis) {
        const invoiceAmount = decodedInvoice.satoshis
        if (invoiceAmount > state.balance) {
          throw new PaymentError("Insufficient funds to complete this payment", "INSUFFICIENT_FUNDS")
        }
      }

      // Attempt to pay the invoice
      const paymentStarted = await window.nwcjs.tryToPayInvoice(state.nwcInfo, invoice, null)

      // If payment was successfully sent to the relay, consider it settled
      if (paymentStarted) {
        console.log("Payment successfully delivered to relay")

        // Force refresh transactions and balance after successful relay delivery
        setTimeout(async () => {
          await getTransactions(true)
          await refreshBalance()
        }, 2000)

        return true
      } else {
        // If payment couldn't be delivered to the relay, it failed
        throw new PaymentError("Failed to deliver payment to relay")
      }
    } catch (error) {
      // Categorize the error for better handling
      const categorizedError = categorizeError(error)
      console.error("Payment error:", categorizedError)

      // Rethrow the categorized error
      throw categorizedError
    }
  }

  const checkInvoice = async (invoice: string): Promise<any> => {
    if (!isConnected || !state.nwcInfo || !window.nwcjs) return null

    try {
      const delay_tolerance = 5
      const status_info = await window.nwcjs.checkInvoice(state.nwcInfo, invoice, delay_tolerance)

      if (status_info === "timed out") {
        return null
      }

      if ("error" in status_info && status_info.error) {
        return null
      }

      return status_info
    } catch (error) {
      console.error("Failed to check invoice", error)
      return null
    }
  }

  const switchCurrency = () => {
    const currentIndex = state.currencies.indexOf(state.currency)
    const nextIndex = (currentIndex + 1) % state.currencies.length
    setState((prev) => ({
      ...prev,
      currency: prev.currencies[nextIndex],
    }))
  }

  const formatBalance = (amount: number): string => {
    switch (state.currency) {
      case "btc":
        return (amount / 100000000).toFixed(8) + " BTC"
      case "usd":
        const usdValue = (amount / 100000000) * (state.exchangeRates.usd || 65000)
        return "$" + usdValue.toFixed(2)
      case "sats":
      default:
        return amount.toLocaleString() + " sats"
    }
  }

  const formatCurrency = (amount: number): string => {
    switch (state.currency) {
      case "btc":
        return "BTC"
      case "usd":
        return "USD"
      case "sats":
      default:
        return "sats"
    }
  }

  // Improved connectNewWallet function
  const connectNewWallet = async (name: string, nwcString: string): Promise<boolean> => {
    try {
      if (!window.nwcjs) {
        toast({
          title: "NWC Library Missing",
          description: "The nwcjs library is not loaded. Please check your setup.",
          variant: "destructive",
        })
        return false
      }

      // Process the NWC string
      const nwcInfo = window.nwcjs.processNWCstring(nwcString)

      if (!nwcInfo) {
        toast({
          title: "Connection Failed",
          description: "Invalid NWC string. Please check and try again.",
          variant: "destructive",
        })
        return false
      }

      // Create a new wallet entry
      const newWallet: WalletData = {
        id: crypto.randomUUID(),
        name,
        nwcString,
        balance: 0,
        nwcInfo,
      }

      // Get initial balance
      setState((prev) => ({ ...prev, isLoadingBalance: true }))

      try {
        const delay_tolerance = 5
        const balance_info = await window.nwcjs.getBalance(nwcInfo, delay_tolerance)

        if (
          balance_info !== "timed out" &&
          typeof balance_info === "object" &&
          "result" in balance_info &&
          balance_info.result &&
          "balance" in balance_info.result
        ) {
          // Divide by 1000 to convert from millisats to sats
          newWallet.balance = Math.floor(balance_info.result.balance / 1000)
        }
      } catch (error) {
        console.error("Failed to get initial balance for new wallet:", error)
        // Continue with balance 0
      } finally {
        setState((prev) => ({ ...prev, isLoadingBalance: false }))
      }

      // Update state with the new wallet
      setState((prev) => {
        const existingWallets = prev.connectedWallets || []
        return {
          ...prev,
          nwcString: !existingWallets.length ? nwcString : prev.nwcString,
          nwcInfo: !existingWallets.length ? nwcInfo : prev.nwcInfo,
          connectedWallets: [...existingWallets, newWallet],
          activeWalletId: newWallet.id,
          balance: newWallet.balance,
          // Clear transaction history for the new wallet
          history: {},
        }
      })

      // Fetch transactions for the new wallet
      await getTransactions(true)

      return true
    } catch (error) {
      console.error("Failed to connect new wallet:", error)
      toast({
        title: "Connection Failed",
        description: "Could not connect to the wallet. Please try again.",
        variant: "destructive",
      })
      return false
    }
  }

  // Improved switchWallet function
  const switchWallet = async (walletId: string) => {
    // First find the wallet
    const wallet = state.connectedWallets.find((w) => w.id === walletId)
    if (!wallet) return

    // Clear current transactions from state
    setState((prev) => ({
      ...prev,
      activeWalletId: walletId,
      nwcString: wallet.nwcString,
      nwcInfo: wallet.nwcInfo,
      balance: wallet.balance,
      history: {},
      lastSync: Date.now(),
    }))

    // Load cached transactions for this wallet
    const cachedTransactions = getStoredTransactions(walletId)
    if (Object.keys(cachedTransactions).length > 0) {
      setState((prev) => ({
        ...prev,
        history: cachedTransactions,
      }))
    }

    // After state update, fetch fresh data for the new wallet
    setTimeout(async () => {
      await refreshBalance()
      await getTransactions()
    }, 100)
  }

  const removeWallet = (walletId: string) => {
    // Clear transactions for this wallet
    clearTransactions(walletId)

    setState((prev) => {
      const updatedWallets = prev.connectedWallets.filter((w) => w.id !== walletId)
      const newActiveId =
        prev.activeWalletId === walletId
          ? updatedWallets.length > 0
            ? updatedWallets[0].id
            : null
          : prev.activeWalletId

      const newWallet = newActiveId ? updatedWallets.find((w) => w.id === newActiveId) : null

      return {
        ...prev,
        connectedWallets: updatedWallets,
        activeWalletId: newActiveId,
        nwcString: newWallet?.nwcString || null,
        nwcInfo: newWallet?.nwcInfo || null,
        balance: newWallet?.balance || 0,
        // Clear history if we removed the active wallet
        history: prev.activeWalletId === walletId ? {} : prev.history,
      }
    })

    // If we switched to a new wallet, load its transactions
    setTimeout(async () => {
      const newActiveId = state.activeWalletId
      if (newActiveId && newActiveId !== walletId) {
        const cachedTransactions = getStoredTransactions(newActiveId)
        setState((prev) => ({
          ...prev,
          history: cachedTransactions,
        }))

        // Refresh data for the new active wallet
        await refreshBalance()
        await getTransactions()
      }
    }, 100)
  }

  const getActiveWallet = (): WalletData | null => {
    return state.connectedWallets.find((w) => w.id === state.activeWalletId) || null
  }

  // Update PIN-related functions to include threshold
  const setPin = (pin: string, threshold: number) => {
    setState((prev) => ({
      ...prev,
      pin,
      pinEnabled: true,
      pinThreshold: threshold,
    }))
  }

  const enablePin = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      pinEnabled: enabled,
      // If disabling PIN, also clear it
      pin: enabled ? prev.pin : null,
    }))
  }

  const verifyPin = (pin: string) => {
    return state.pin === pin
  }

  const isPinEnabled = () => {
    return state.pinEnabled && state.pin !== null
  }

  // New functions for PIN threshold
  const isPinRequired = (amount: number) => {
    return state.pinEnabled && state.pin !== null && amount >= state.pinThreshold
  }

  const getPinThreshold = () => {
    return state.pinThreshold
  }

  const setPinThreshold = (threshold: number) => {
    setState((prev) => ({
      ...prev,
      pinThreshold: threshold,
    }))
  }

  const makeInvoice = async (amount: number, description: string): Promise<string | null> => {
    if (!isConnected || !state.nwcInfo || !window.nwcjs) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create an invoice.",
        variant: "destructive",
      })
      return null
    }

    try {
      const invoiceResponse = await window.nwcjs.makeInvoice(state.nwcInfo, amount * 1000, description)

      if (invoiceResponse && invoiceResponse.result && invoiceResponse.result.invoice) {
        return invoiceResponse.result.invoice
      } else {
        toast({
          title: "Invoice creation failed",
          description: "Could not create invoice. Please try again.",
          variant: "destructive",
        })
        return null
      }
    } catch (error) {
      console.error("Failed to create invoice:", error)
      toast({
        title: "Invoice creation failed",
        description: "An error occurred while creating the invoice. Please try again.",
        variant: "destructive",
      })
      return null
    }
  }

  // Add the new functions to the context provider value
  return (
    <WalletContext.Provider
      value={{
        state,
        isConnected,
        connectWallet,
        disconnectWallet,
        refreshBalance,
        getTransactions,
        makeInvoice,
        payInvoice,
        checkInvoice,
        switchCurrency,
        formatBalance,
        formatCurrency,
        connectNewWallet,
        switchWallet,
        removeWallet,
        getActiveWallet,
        setPin,
        enablePin,
        verifyPin,
        isPinEnabled,
        isPinRequired,
        getPinThreshold,
        setPinThreshold,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider")
  }
  return context
}

