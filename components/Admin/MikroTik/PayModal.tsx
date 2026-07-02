import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  secret: any;
  billingPlans: any[];
  profiles: any[];
  routerId: string;
  onSuccess: () => void;
}

const PayModal: React.FC<PayModalProps> = ({ isOpen, onClose, secret, billingPlans, profiles, routerId, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [localProfiles, setLocalProfiles] = useState<any[]>(profiles);
  const [expiredProfile, setExpiredProfile] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [numMonths, setNumMonths] = useState(1);
  const [discountDays, setDiscountDays] = useState(0);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  
  // Use localProfiles if profiles prop is empty
  const availableProfiles = localProfiles.length > 0 ? localProfiles : profiles;

  useEffect(() => {
    if (secret && billingPlans.length > 0) {
      // Auto-find billing plan based on secret's profile
      const plan = billingPlans.find(p => p.pppoe_profile === secret.profile);
      if (plan) {
        setSelectedPlan(plan);
      }
    }
    
    // Set payment date to now
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setPaymentDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    
    // Load profiles if not loaded
    if (localProfiles.length === 0 && routerId) {
      loadMikroTikProfiles();
    }
  }, [secret, billingPlans, routerId]);

  const loadMikroTikProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const profs = await apiClient.getMikrotikProfiles(routerId);
      setLocalProfiles(Array.isArray(profs) ? profs : []);
    } catch (e: any) {
      console.error('Failed to load MikroTik profiles:', e);
      setError('Failed to load PPP profiles from MikroTik');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const calculateNextDueDate = (currentDueDate: string, paymentDate: string) => {
    // If there's an existing due date, extend from that
    // Otherwise, start from payment date
    const baseDate = currentDueDate ? new Date(currentDueDate) : new Date(paymentDate);
    
    // Add number of months based on numMonths state
    baseDate.setMonth(baseDate.getMonth() + numMonths);
    return baseDate.toISOString();
  };

  const calculateDiscount = () => {
    if (!selectedPlan || discountDays <= 0) return 0;
    const dailyRate = selectedPlan.price / 30; // Assume 30 days per month
    return dailyRate * discountDays;
  };

  const calculateTotalAmount = () => {
    if (!selectedPlan) return 0;
    return selectedPlan.price * numMonths;
  };

  const calculateFinalAmount = () => {
    if (!selectedPlan) return 0;
    const totalAmount = calculateTotalAmount();
    const discount = calculateDiscount();
    return Math.max(0, totalAmount - discount);
  };

  const handleProcessPayment = async () => {
    if (!selectedPlan) {
      setError('Please select a billing plan');
      return;
    }

    if (!expiredProfile) {
      setError('Please select an expired profile');
      return;
    }

    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const paymentDateObj = new Date(paymentDate);
      const nextDueDate = calculateNextDueDate(secret.duedate, paymentDate);
      const finalAmount = calculateFinalAmount();
      const discount = calculateDiscount();

      await apiClient.processMikrotikPayment(routerId, {
        secret_id: secret['.id'],
        username: secret.name,
        billing_plan_id: selectedPlan.id,
        plan_name: selectedPlan.plan_name,
        pppoe_profile: selectedPlan.pppoe_profile,
        amount: finalAmount,
        original_amount: calculateTotalAmount(),
        num_months: numMonths,
        discount_days: discountDays,
        discount_amount: discount,
        currency: selectedPlan.currency || 'PHP',
        payment_date: paymentDateObj.toISOString(),
        next_duedate: nextDueDate,
        expired_profile: expiredProfile,
        payment_method: 'cash',
        notes: notes
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process payment');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Process Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* User Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">User Information</h3>
            <div className="space-y-1 text-sm">
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Username:</span> {secret.name}</p>
              <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Current Profile:</span> {secret.profile}</p>
              {secret.duedate && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Current Due Date:</span>{' '}
                  {new Date(secret.duedate).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Billing Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Billing Plan
            </label>
            <select
              value={selectedPlan?.id || ''}
              onChange={(e) => {
                const plan = billingPlans.find(p => p.id === e.target.value);
                setSelectedPlan(plan || null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Billing Plan</option>
              {billingPlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.plan_name} - {plan.currency || 'PHP'} {plan.price.toFixed(2)}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <span className="font-semibold">Price:</span> {selectedPlan.currency || 'PHP'} {selectedPlan.price.toFixed(2)}
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  <span className="font-semibold">Profile:</span> {selectedPlan.pppoe_profile}
                </p>
              </div>
            )}
          </div>

          {/* Expired Profile */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expired / Non-Payment Profile
            </label>
            {loadingProfiles ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading profiles...</div>
            ) : (
              <select
                value={expiredProfile}
                onChange={(e) => setExpiredProfile(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select Expired Profile</option>
                {availableProfiles.map(profile => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              User will be moved to this profile when they expire
            </p>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Date
            </label>
            <input
              type="datetime-local"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Number of Months */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Number of Months
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={numMonths}
              onChange={(e) => setNumMonths(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter number of months"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How many months the client is paying for
            </p>
          </div>

          {/* Discount Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Discount Days (Client was offline)
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={discountDays}
              onChange={(e) => setDiscountDays(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter days offline"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Days client was without internet - will be deducted from billing
            </p>
            {discountDays > 0 && selectedPlan && (
              <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <span className="font-semibold">Discount:</span> {selectedPlan.currency || 'PHP'} {calculateDiscount().toFixed(2)} ({discountDays} days × {(selectedPlan.price / 30).toFixed(2)}/day)
                </p>
              </div>
            )}
          </div>

          {/* Payment Summary */}
          {selectedPlan && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Payment Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Plan Price (per month):</span>
                  <span>{selectedPlan.currency || 'PHP'} {selectedPlan.price.toFixed(2)}</span>
                </div>
                {numMonths > 1 && (
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Number of Months:</span>
                    <span>× {numMonths} months</span>
                  </div>
                )}
                {numMonths > 1 && (
                  <div className="flex justify-between text-gray-700 dark:text-gray-300 font-medium">
                    <span>Subtotal:</span>
                    <span>{selectedPlan.currency || 'PHP'} {calculateTotalAmount().toFixed(2)}</span>
                  </div>
                )}
                {discountDays > 0 && (
                  <div className="flex justify-between text-red-600 dark:text-red-400">
                    <span>Discount ({discountDays} days):</span>
                    <span>- {selectedPlan.currency || 'PHP'} {calculateDiscount().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-green-800 dark:text-green-300 border-t border-blue-200 dark:border-blue-700 pt-2 mt-2">
                  <span>Final Amount:</span>
                  <span>{selectedPlan.currency || 'PHP'} {calculateFinalAmount().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Add any notes about this payment..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessPayment}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Process Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayModal;
