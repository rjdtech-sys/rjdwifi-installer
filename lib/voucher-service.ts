import { VoucherActivationRequest, VoucherActivationResponse } from '../types';

class VoucherService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Activate a voucher code
   * @param code - The voucher code to activate
   * @returns Promise with activation response
   */
  async activateVoucher(code: string): Promise<VoucherActivationResponse> {
    try {
      // Validate input
      if (!code || typeof code !== 'string') {
        throw new Error('Invalid voucher code provided');
      }

      const requestBody: VoucherActivationRequest = {
        code: code.trim().toUpperCase()
      };

      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('rjd_session_token') || '' : '';

      const response = await fetch(`${this.baseUrl}/api/vouchers/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'x-session-token': sessionToken } : {})
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle different error types
        const errorMessage = data.message || data.error || 'Unknown error occurred';
        throw new Error(errorMessage);
      }

      if (!data.success) {
        throw new Error(data.message || 'Voucher activation failed');
      }

      return data;
    } catch (error) {
      // Re-throw with consistent error format
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error or server unavailable');
    }
  }

  /**
   * Validate voucher code format
   * @param code - The voucher code to validate
   * @returns boolean indicating if code format is valid
   */
  validateVoucherCode(code: string): boolean {
    if (!code || typeof code !== 'string') {
      return false;
    }
    
    const trimmedCode = code.trim();
    // Basic validation - codes should be alphanumeric and reasonable length
    return trimmedCode.length >= 3 && trimmedCode.length <= 50 && /^[A-Z0-9]+$/.test(trimmedCode);
  }

  /**
   * Format voucher code for display
   * @param code - The voucher code to format
   * @returns formatted code string
   */
  formatVoucherCode(code: string): string {
    if (!code) return '';
    return code.trim().toUpperCase();
  }
}

// Export singleton instance
export const voucherService = new VoucherService();

// Export hook for React components
export const useVoucherService = () => {
  return voucherService;
};

export default VoucherService;
