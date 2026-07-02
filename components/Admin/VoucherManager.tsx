import React, { useState, useEffect } from 'react';
import { Voucher } from '../../types';
import { apiClient } from '../../lib/api';

const VoucherManager: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filteredVouchers, setFilteredVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'used' | 'unused'>('all');

  // Form states for generate
  const [amount, setAmount] = useState<number>(10);
  const [timeMinutes, setTimeMinutes] = useState<number>(60);
  const [count, setCount] = useState<number>(1);
  const [voucherType, setVoucherType] = useState<'time_based' | 'monthly'>('time_based');
  const [durationDays, setDurationDays] = useState<number>(30);

  // Form states for manual create
  const [manualCode, setManualCode] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<number>(10);
  const [manualTimeMinutes, setManualTimeMinutes] = useState<number>(60);
  const [manualVoucherType, setManualVoucherType] = useState<'time_based' | 'monthly'>('time_based');
  const [manualDurationDays, setManualDurationDays] = useState<number>(30);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/vouchers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('rjd_admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vouchers');
      }

      const data = await response.json();
      setVouchers(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  useEffect(() => {
    // Apply filtering
    if (filter === 'all') {
      setFilteredVouchers(vouchers);
    } else if (filter === 'used') {
      setFilteredVouchers(vouchers.filter(v => v.is_used === 1));
    } else {
      setFilteredVouchers(vouchers.filter(v => v.is_used === 0));
    }
  }, [vouchers, filter]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} animate-fade-in`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('animate-fade-out');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };

  const handleGenerateVouchers = async () => {
    try {
      const response = await fetch('/api/vouchers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('rjd_admin_token')}`
        },
        body: JSON.stringify({
          amount,
          time_minutes: timeMinutes,
          count,
          voucher_type: voucherType,
          duration_days: voucherType === 'monthly' ? durationDays : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate vouchers');
      }

      const data = await response.json();

      setShowGenerateModal(false);
      fetchVouchers();

      showToast(`Successfully generated ${data.vouchers.length} voucher(s)!`, 'success');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleCreateManualVoucher = async () => {
    try {
      if (!manualCode.trim() || manualCode.trim().length < 3) {
        showToast('Voucher code must be at least 3 characters', 'error');
        return;
      }

      const data = await apiClient.createVoucher({
        code: manualCode.trim().toUpperCase(),
        amount: manualAmount,
        time_minutes: manualTimeMinutes,
        voucher_type: manualVoucherType,
        duration_days: manualVoucherType === 'monthly' ? manualDurationDays : undefined
      });

      setShowManualModal(false);
      setManualCode('');
      fetchVouchers();

      showToast(data.message || 'Voucher created successfully!', 'success');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleDeleteVoucher = async (id: number) => {
    if (!confirm('Are you sure you want to delete this unused voucher?')) {
      return;
    }

    try {
      const response = await fetch(`/api/vouchers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('rjd_admin_token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete voucher');
      }

      fetchVouchers();
      showToast('Voucher deleted successfully!', 'success');
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not used';
    return new Date(dateString).toLocaleString();
  };

  const getStatusDisplay = (voucher: any) => {
    if (voucher.status === 'unused') {
      return { text: 'Unused', class: 'bg-green-100 text-green-800' };
    }
    if (voucher.voucher_type === 'monthly') {
      if (voucher.status === 'expired' || (voucher.remaining_days !== undefined && voucher.remaining_days <= 0)) {
        return { text: 'Expired', class: 'bg-gray-100 text-gray-800' };
      }
      return {
        text: `Active - ${voucher.remaining_days || 0}d left`,
        class: 'bg-blue-100 text-blue-800'
      };
    }
    if (voucher.voucher_type === 'time_based' && voucher.is_used === 1) {
      const rem = voucher.remaining_minutes || 0;
      if (rem > 0) {
        return { text: `${rem} min left`, class: 'bg-amber-100 text-amber-800' };
      }
      return { text: 'Consumed', class: 'bg-red-100 text-red-800' };
    }
    return { text: 'Used', class: 'bg-red-100 text-red-800' };
  };

  const exportVouchers = () => {
    const csvContent = [
      ['Code', 'Amount', 'Time (min)', 'Type', 'Duration', 'Created By', 'Status', 'Created At', 'Used At', 'Used By MAC', 'Used By IP'],
      ...filteredVouchers.map(voucher => [
        voucher.code,
        `₱${voucher.amount}`,
        voucher.time_minutes.toString(),
        voucher.voucher_type || 'time_based',
        voucher.duration_days ? `${voucher.duration_days} days` : 'N/A',
        voucher.created_by,
        voucher.status || (voucher.is_used === 1 ? 'Used' : 'Unused'),
        new Date(voucher.created_at).toLocaleString(),
        voucher.used_at ? new Date(voucher.used_at).toLocaleString() : 'Not used',
        voucher.used_by_mac || 'N/A',
        voucher.used_by_ip || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vouchers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showToast('Vouchers exported successfully!', 'success');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Voucher Management</h2>
          <p className="text-slate-600 mt-1">Manage internet access vouchers</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={exportVouchers}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            Add Voucher
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            Generate Vouchers
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Filter:</span>
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              All ({vouchers.length})
            </button>
            <button
              onClick={() => setFilter('unused')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-300 ${filter === 'unused' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Unused ({vouchers.filter(v => v.is_used === 0).length})
            </button>
            <button
              onClick={() => setFilter('used')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-slate-300 ${filter === 'used' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Used ({vouchers.filter(v => v.is_used === 1).length})
            </button>
          </div>
        </div>

        <div className="text-sm text-slate-600 ml-auto">
          Showing {filteredVouchers.length} of {vouchers.length} vouchers
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Code</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Amount</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Time (min)</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Type</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Created By</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Used At</th>
                  <th className="text-left py-3 px-4 text-slate-600 font-semibold text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                      No vouchers found. {filter === 'all' ? 'Generate some to get started.' : `No ${filter} vouchers found.`}
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher) => {
                    const statusDisplay = getStatusDisplay(voucher);
                    return (
                      <tr key={voucher.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                              {voucher.code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(voucher.code)}
                              className="text-slate-500 hover:text-slate-700"
                              title="Copy code"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">₱{voucher.amount}</td>
                        <td className="py-3 px-4">{voucher.time_minutes}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${voucher.voucher_type === 'monthly' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
                            {voucher.voucher_type === 'monthly' ? 'Monthly' : 'Time'}
                          </span>
                          {voucher.voucher_type === 'monthly' && voucher.duration_days && (
                            <div className="text-xs text-slate-500 mt-1">{voucher.duration_days} days</div>
                          )}
                        </td>
                        <td className="py-3 px-4">{voucher.created_by}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.class}`}>
                            {statusDisplay.text}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {formatDate(voucher.used_at)}
                          {voucher.used_by_mac && (
                            <div className="text-xs text-slate-500 mt-1">MAC: {voucher.used_by_mac}</div>
                          )}
                          {voucher.used_by_ip && (
                            <div className="text-xs text-slate-500 mt-1">IP: {voucher.used_by_ip}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {voucher.is_used === 0 && (
                            <button
                              onClick={() => handleDeleteVoucher(voucher.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Voucher Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Generate New Vouchers</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Type</label>
                <select
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value as 'time_based' | 'monthly')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="time_based">Time Based</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {voucherType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₱)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Duration (minutes)</label>
                <input
                  type="number"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Number of Vouchers</label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="100"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Max 100 vouchers per batch</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2.5 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateVouchers}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Voucher Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add Voucher Manually</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Code</label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter custom code"
                  minLength={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Voucher Type</label>
                <select
                  value={manualVoucherType}
                  onChange={(e) => setManualVoucherType(e.target.value as 'time_based' | 'monthly')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="time_based">Time Based</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {manualVoucherType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration (days)</label>
                  <input
                    type="number"
                    value={manualDurationDays}
                    onChange={(e) => setManualDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₱)</label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Time Duration (minutes)</label>
                <input
                  type="number"
                  value={manualTimeMinutes}
                  onChange={(e) => setManualTimeMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowManualModal(false)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2.5 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManualVoucher}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-medium transition-colors"
              >
                Add Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherManager;
