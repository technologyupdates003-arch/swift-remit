// Paystack Frontend Integration
// This handles Paystack API calls from the frontend since SQL can't make HTTP requests

interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  testMode: boolean;
}

interface PaystackInitializeRequest {
  email: string;
  amount: number; // In kobo for NGN, cents for USD, etc.
  currency: string;
  reference: string;
  callback_url?: string;
  metadata?: any;
}

interface PaystackTransferRequest {
  source: string;
  amount: number;
  recipient: string;
  reason?: string;
  currency?: string;
  reference?: string;
}

interface PaystackTransferRecipientRequest {
  type: string; // 'nuban' for Nigerian banks, 'mobile_money' for mobile money
  name: string;
  account_number: string;
  bank_code: string;
  currency: string;
}

interface PaystackBankListRequest {
  currency: string;
  type?: string;
}

class PaystackService {
  private config: PaystackConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
      secretKey: import.meta.env.PAYSTACK_SECRET_KEY || '',
      testMode: false // Using live keys
    };
    
    this.baseUrl = 'https://api.paystack.co';
  }

  private getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  // Initialize payment transaction
  async initializePayment(request: PaystackInitializeRequest): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment initialization failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Initialize Error:', error);
      throw error;
    }
  }

  // Verify payment transaction
  async verifyPayment(reference: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment verification failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Verify Error:', error);
      throw error;
    }
  }

  // Get list of banks for a currency
  async getBanks(currency: string = 'NGN'): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/bank?currency=${currency}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch banks');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Banks Error:', error);
      throw error;
    }
  }

  // Create transfer recipient
  async createTransferRecipient(request: PaystackTransferRecipientRequest): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transferrecipient`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create transfer recipient');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Create Recipient Error:', error);
      throw error;
    }
  }

  // Initiate transfer (withdrawal)
  async initiateTransfer(request: PaystackTransferRequest): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transfer`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Transfer initiation failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Transfer Error:', error);
      throw error;
    }
  }

  // Verify transfer status
  async verifyTransfer(transferCode: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/transfer/verify/${transferCode}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Transfer verification failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Transfer Verify Error:', error);
      throw error;
    }
  }

  // Resolve account number (verify bank account)
  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders()
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Account resolution failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Resolve Account Error:', error);
      throw error;
    }
  }

  // Get supported countries for transfers
  async getSupportedCountries(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/country`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch countries');
      }

      return await response.json();
    } catch (error) {
      console.error('Paystack Countries Error:', error);
      throw error;
    }
  }

  // Convert amount to smallest currency unit (kobo, cents, etc.)
  convertToSubunit(amount: number, currency: string): number {
    // Most currencies use 100 subunits (cents, kobo, etc.)
    // Some exceptions like JPY use 1:1
    const subunitMultipliers: Record<string, number> = {
      'NGN': 100, // kobo
      'USD': 100, // cents
      'EUR': 100, // cents
      'GBP': 100, // pence
      'KES': 100, // cents
      'ZAR': 100, // cents
      'JPY': 1,   // yen (no subunit)
    };

    return Math.round(amount * (subunitMultipliers[currency] || 100));
  }

  // Convert from subunit to main currency unit
  convertFromSubunit(amount: number, currency: string): number {
    const subunitMultipliers: Record<string, number> = {
      'NGN': 100,
      'USD': 100,
      'EUR': 100,
      'GBP': 100,
      'KES': 100,
      'ZAR': 100,
      'JPY': 1,
    };

    return amount / (subunitMultipliers[currency] || 100);
  }

  // Generate unique reference
  generateReference(prefix: string = 'PSK'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Validate email format
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get currency symbol
  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      'NGN': '₦',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'KES': 'KSh',
      'ZAR': 'R',
      'JPY': '¥',
    };
    return symbols[currency] || currency;
  }
}

export const paystackService = new PaystackService();
export default PaystackService;