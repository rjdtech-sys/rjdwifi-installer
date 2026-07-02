import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';
import AcknowledgementReceipt from './AcknowledgementReceipt';

interface SalesReportPageProps {
  routerId: string;
}

interface SaleRecord {
  id: string;
  router_id: string;
  secret_id: string;
  username: string;
  billing_plan_id?: string;
  plan_name?: string;
  amount: number;
  original_amount?: number;
  num_months?: number;
  discount_days?: number;
  discount_amount?: number;
  currency?: string;
  payment_date: string;
  next_duedate: string;
  expired_profile?: string;
  payment_method?: string;
  notes?: string;
}

const SalesReportPage: React.FC<SalesReportPageProps> = ({ routerId }) => {
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalSales, setTotalSales] = useState(0);
  
  // Edit modal state
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Delete confirmation state
  const [deletingSale, setDeletingSale] = useState<SaleRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Print receipt state
  const [printingSale, setPrintingSale] = useState<SaleRecord | null>(null);
  const [printMode, setPrintMode] = useState<'regular' | 'thermal'>('regular');
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    fetchSales();
  }, [routerId]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      console.log('[SalesReport] Fetching sales for router:', routerId);
      
      const data = await apiClient.getMikrotikSales(routerId, startDate, endDate);
      console.log('[SalesReport] Received data:', data);
      
      setSales(data);
      
      const total = data.reduce((sum: number, sale: SaleRecord) => sum + sale.amount, 0);
      setTotalSales(total);
    } catch (err) {
      console.error('[SalesReport] Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    fetchSales();
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    fetchSales();
  };

  const formatCurrency = (amount: number, currency: string = 'PHP') => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Edit handlers
  const handleEdit = (sale: SaleRecord) => {
    setEditingSale({ ...sale });
    setShowEditModal(true);
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;
    
    try {
      await apiClient.updateMikrotikSale(editingSale.id, editingSale);
      
      setShowEditModal(false);
      fetchSales();
    } catch (err) {
      console.error('[SalesReport] Error updating sale:', err);
      alert('Failed to update sale record');
    }
  };

  // Delete handlers
  const handleDeleteClick = (sale: SaleRecord) => {
    setDeletingSale(sale);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSale) return;
    
    try {
      await apiClient.deleteMikrotikSale(deletingSale.id);
      
      setShowDeleteConfirm(false);
      setDeletingSale(null);
      fetchSales();
    } catch (err) {
      console.error('[SalesReport] Error deleting sale:', err);
      alert('Failed to delete sale record');
    }
  };

  // Print handlers
  const handlePrint = (sale: SaleRecord, mode: 'regular' | 'thermal') => {
    setPrintingSale(sale);
    setPrintMode(mode);
    setShowReceipt(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading sales report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sales Report</h2>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleFilter}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Filter
            </button>
            <button
              onClick={handleClearFilter}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400">Total Sales</p>
              <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                {formatCurrency(totalSales)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600 dark:text-green-400">Total Transactions</p>
              <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                {sales.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {sales.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No sales recorded</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Payment transactions will appear here once processed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Months
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Original
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Final Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Next Due Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {sale.username}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {sale.plan_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-gray-300">
                      {sale.num_months || 1} mo
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {formatCurrency(sale.original_amount || sale.amount, sale.currency)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                      {sale.discount_days && sale.discount_days > 0 ? (
                        <span>-{formatCurrency(sale.discount_amount || 0, sale.currency)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(sale.amount, sale.currency)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(sale.payment_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      {formatDate(sale.next_duedate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        {/* Print Buttons */}
                        <button
                          onClick={() => handlePrint(sale, 'regular')}
                          className="px-2 py-1 text-[10px] font-bold text-green-600 bg-green-50 rounded hover:bg-green-100"
                          title="Print Regular Receipt"
                        >
                          Print
                        </button>
                        <button
                          onClick={() => handlePrint(sale, 'thermal')}
                          className="px-2 py-1 text-[10px] font-bold text-purple-600 bg-purple-50 rounded hover:bg-purple-100"
                          title="Print Thermal Receipt"
                        >
                          Thermal
                        </button>
                        {/* Edit Button */}
                        <button
                          onClick={() => handleEdit(sale)}
                          className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteClick(sale)}
                          className="px-2 py-1 text-[10px] font-bold text-red-600 bg-red-50 rounded hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Sale Record</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                <input
                  type="text"
                  value={editingSale.username}
                  onChange={(e) => setEditingSale({ ...editingSale, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Name</label>
                <input
                  type="text"
                  value={editingSale.plan_name || ''}
                  onChange={(e) => setEditingSale({ ...editingSale, plan_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingSale.amount}
                    onChange={(e) => setEditingSale({ ...editingSale, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Months</label>
                  <input
                    type="number"
                    value={editingSale.num_months || 1}
                    onChange={(e) => setEditingSale({ ...editingSale, num_months: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Date</label>
                <input
                  type="datetime-local"
                  value={editingSale.payment_date ? new Date(editingSale.payment_date).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingSale({ ...editingSale, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Due Date</label>
                <input
                  type="datetime-local"
                  value={editingSale.next_duedate ? new Date(editingSale.next_duedate).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditingSale({ ...editingSale, next_duedate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={editingSale.notes || ''}
                  onChange={(e) => setEditingSale({ ...editingSale, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSale}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deletingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Sale Record?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Are you sure you want to delete the sale record for <span className="font-semibold">{deletingSale.username}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {showReceipt && printingSale && (
        <AcknowledgementReceipt
          sale={printingSale}
          printMode={printMode}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};

export default SalesReportPage;
