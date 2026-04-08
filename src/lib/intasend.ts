// IntaSend Frontend Integration
// This handles IntaSend API calls from the frontend since SQL can't make HTTP requests

interface IntaSendConfig {
  publicKey: string;
  secretKey: string;
  testMode: boolean;
}

interface STKPushRequest {
  phone_number: string;
  amount: number;
  narrative?: string;
  api_ref?: string;
}

interface B2CRequest {
  transactions: Array<{
    name: string;
    account: string;
    amount: number;
    narrative: string;
  }>;
  currency: string;
  requires_approval: string;
}

interface WalletTransferRequest {
  origin_wallet_id: string;
  destination_wallet_id: string;
  amount: number;
  narrative: string;
}

class IntaSendService {
  private config: IntaSendConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      publicKey: import.meta.env.VITE_INTASEND_PUBLIC_KEY || '',
      secretKey: import.meta.env.INTASEND_SECRET_KEY || '',
      testMode: false // Using live keys
    };
    
    this.baseUrl = this.config.testMode 
      ? 'https://sandbox.intasend.com/api/v1'
      : 'https://payment.intasend.com/api/v1';
  }

  private getAuthHeaders() {
    const credentials = btoa(`${this.config.publicKey}:${this.config.secretKey}`);
    return {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    };
  }

  // M-Pesa STK Push for funding wallets
  async initiateSTKPush(request: STKPushRequest): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/mpesa-stk-push/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          phone_number: request.phone_number,
          amount: request.amount,
          narrative: request.narrative || 'Wallet funding',
          api_ref: request.api_ref || `WLT-${Date.now()}`
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'STK Push failed');
      }

      return await response.json();
    } catch (error) {
      console.error('IntaSend STK Push Error:', error);
      throw error;
    }
  }

  // M-Pesa B2C for withdrawals
  async initiateB2C(request: B2CRequest): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/send-money/mpesa/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'B2C transfer failed');
      }

      return await response.json();
    } catch (error) {
      console.error('IntaSend B2C Error:', error);
      throw error;
    }
  }

  // Check transaction status
  async checkTransactionStatus(transactionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/payment/status/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          invoice_id: transactionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Status check failed');
      }

      return await response.json();
    } catch (error) {
      console.error('IntaSend Status Check Error:', error);
      throw error;
    }
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): boolean {
    return /^254[17][0-9]{8}$/.test(phoneNumber);
  }

  // Format phone number to IntaSend format
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle different input formats
    if (digits.startsWith('254')) {
      return digits.slice(0, 12); // 254XXXXXXXXX
    } else if (digits.startsWith('0')) {
      return '254' + digits.slice(1, 10); // 0XXXXXXXXX -> 254XXXXXXXXX
    } else if (digits.startsWith('7') || digits.startsWith('1')) {
      return '254' + digits.slice(0, 9); // 7XXXXXXXX -> 254XXXXXXXXX
    }
    
    return digits.slice(0, 12);
  }
}

export const intaSendService = new IntaSendService();
export default IntaSendService;