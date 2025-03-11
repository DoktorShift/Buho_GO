// Error types for better error handling
export class NetworkError extends Error {
  constructor(
    message: string,
    public originalError?: any,
  ) {
    super(message)
    this.name = "NetworkError"
  }
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: any,
  ) {
    super(message)
    this.name = "PaymentError"
  }
}

export class WalletConnectionError extends Error {
  constructor(
    message: string,
    public originalError?: any,
  ) {
    super(message)
    this.name = "WalletConnectionError"
  }
}

// Helper function to determine error type
export function categorizeError(error: any): Error {
  if (!error) return new Error("Unknown error")

  // Network errors
  if (
    error.message?.includes("network") ||
    error.message?.includes("offline") ||
    error.message?.includes("connection") ||
    (error instanceof TypeError && error.message?.includes("fetch"))
  ) {
    return new NetworkError("Network connection issue", error)
  }

  // Payment specific errors
  if (
    error.message?.includes("payment") ||
    error.message?.includes("invoice") ||
    error.message?.includes("insufficient funds")
  ) {
    return new PaymentError(error.message, error.code, error)
  }

  // Wallet connection errors
  if (error.message?.includes("wallet") || error.message?.includes("NWC") || error.message?.includes("connection")) {
    return new WalletConnectionError(error.message, error)
  }

  return error instanceof Error ? error : new Error(String(error))
}

// User-friendly error messages
export function getUserFriendlyErrorMessage(error: any): string {
  const categorizedError = error instanceof Error ? error : categorizeError(error)

  if (categorizedError instanceof NetworkError) {
    return "Network connection issue. Please check your internet connection and try again."
  }

  if (categorizedError instanceof PaymentError) {
    if (categorizedError.message.includes("insufficient funds")) {
      return "Insufficient funds to complete this payment."
    }
    if (categorizedError.message.includes("expired")) {
      return "This invoice has expired. Please request a new one."
    }
    if (categorizedError.message.includes("relay")) {
      return "Payment could not be delivered to the network. Please check your transaction history to confirm status."
    }
    if (categorizedError.code === "RELAY_TIMEOUT") {
      return "Payment sent but waiting for confirmation. Please check your transaction history for updates."
    }
    return "Payment issue detected. Please check your transaction history to confirm if the payment went through."
  }

  if (categorizedError instanceof WalletConnectionError) {
    return "Wallet connection issue. Please reconnect your wallet."
  }

  return "Something went wrong. Please try again."
}

// Transaction idempotency helpers
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

