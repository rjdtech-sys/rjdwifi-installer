import React, { useState } from 'react';
import { voucherService } from '../../lib/voucher-service';

interface VoucherActivationProps {
  onVoucherActivate: (voucherCode: string) => void;
  loading: boolean;
}

const VoucherActivation: React.FC<VoucherActivationProps> = ({ onVoucherActivate, loading }) => {
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setError('');
    
    // Validate input
    if (!voucherCode.trim()) {
      setError('Please enter a voucher code');
      return;
    }
    
    if (!voucherService.validateVoucherCode(voucherCode)) {
      setError('Invalid voucher code format');
      return;
    }
    
    // Call the parent handler
    onVoucherActivate(voucherCode.trim());
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span>🎟️</span> Use Voucher
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="voucherCode" className="block text-sm font-medium text-gray-700 mb-1">
            Enter Voucher Code
          </label>
          <input
            type="text"
            id="voucherCode"
            value={voucherCode}
            onChange={(e) => {
              setVoucherCode(e.target.value);
              // Clear error when user types
              if (error) setError('');
            }}
            placeholder="Enter your voucher code"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !loading) {
                handleSubmit(e as any);
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            disabled={loading}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || !voucherCode.trim()}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            'Activate Voucher'
          )}
        </button>
      </form>
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500">
        <p>Voucher codes are provided by the administrator. Contact them to purchase a voucher.</p>
        <p className="mt-1">Tip: Voucher codes are usually 6-12 characters long and contain letters and numbers.</p>
      </div>
    </div>
  );
};

export default VoucherActivation;