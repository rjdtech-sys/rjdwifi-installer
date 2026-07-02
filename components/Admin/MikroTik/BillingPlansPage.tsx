import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';
import { MikrotikBillingData } from '../../../types';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
  routerId: string;
  onRefresh: () => void;
};

type BillingPlan = {
  id: string;
  router_id: string;
  plan_name: string;
  pppoe_profile: string;
  price: number;
  currency: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

const BillingPlansPage: React.FC<Props> = ({ billing, loading, routerId, onRefresh }) => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    plan_name: '',
    pppoe_profile: '',
    price: '',
    currency: 'PHP',
    is_active: 1
  });

  const pppoeProfiles = billing?.ppp_profiles || [];

  useEffect(() => {
    if (routerId) {
      loadPlans();
    }
  }, [routerId]);

  const loadPlans = async () => {
    try {
      const data = await apiClient.getMikrotikBillingPlans(routerId);
      setPlans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load billing plans:', e);
    }
  };

  const resetForm = () => {
    setFormData({ plan_name: '', pppoe_profile: '', price: '', currency: 'PHP', is_active: 1 });
    setShowForm(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formData.plan_name || !formData.pppoe_profile || !formData.price) {
      alert('Plan name, PPPoE profile, and price are required');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.createMikrotikBillingPlan(routerId, {
        plan_name: formData.plan_name,
        pppoe_profile: formData.pppoe_profile,
        price: parseFloat(formData.price),
        currency: formData.currency,
        is_active: formData.is_active
      });
      resetForm();
      loadPlans();
      alert('Billing plan created successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to create billing plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (plan: BillingPlan) => {
    setFormData({
      plan_name: plan.plan_name || '',
      pppoe_profile: plan.pppoe_profile || '',
      price: String(plan.price || ''),
      currency: plan.currency || 'PHP',
      is_active: plan.is_active !== undefined ? plan.is_active : 1
    });
    setEditingId(plan.id);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setActionLoading(true);
    try {
      await apiClient.updateMikrotikBillingPlan(routerId, editingId, {
        plan_name: formData.plan_name,
        pppoe_profile: formData.pppoe_profile,
        price: parseFloat(formData.price),
        currency: formData.currency,
        is_active: formData.is_active
      });
      resetForm();
      loadPlans();
      alert('Billing plan updated successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to update billing plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (planId: string, planName: string) => {
    if (!confirm(`Delete billing plan "${planName}"?`)) return;
    setActionLoading(true);
    try {
      await apiClient.deleteMikrotikBillingPlan(routerId, planId);
      loadPlans();
      alert('Billing plan deleted successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete billing plan');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Billing</div>
          <div className="text-sm font-bold text-slate-900">Billing Plans</div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!routerId || actionLoading || pppoeProfiles.length === 0}
          className="admin-btn-primary px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
        >
          Add Plan
        </button>
      </div>

      {pppoeProfiles.length === 0 && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-[11px]">
          No PPPoE profiles found. Please create a profile first in the PPPoE Profiles tab.
        </div>
      )}

      {showForm && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="text-xs font-bold text-slate-900 mb-3">
            {editingId ? 'Edit Plan' : 'New Plan'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="admin-input text-xs"
              placeholder="Plan Name *"
              value={formData.plan_name}
              onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
              disabled={actionLoading}
            />
            <select
              className="admin-input text-xs"
              value={formData.pppoe_profile}
              onChange={(e) => setFormData({ ...formData, pppoe_profile: e.target.value })}
              disabled={actionLoading}
            >
              <option value="">Select PPPoE Profile *</option>
              {pppoeProfiles.map((p: any, idx: number) => (
                <option key={idx} value={p.name || p['name']}>
                  {p.name || 'N/A'}
                </option>
              ))}
            </select>
            <input
              className="admin-input text-xs"
              type="number"
              step="0.01"
              min="0"
              placeholder="Price *"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              disabled={actionLoading}
            />
            <select
              className="admin-input text-xs"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              disabled={actionLoading}
            >
              <option value="PHP">PHP</option>
              <option value="USD">USD</option>
            </select>
            <select
              className="admin-input text-xs"
              value={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
              disabled={actionLoading}
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={actionLoading || !formData.plan_name || !formData.pppoe_profile || !formData.price}
              className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              disabled={actionLoading}
              className="admin-btn-secondary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-2 text-left font-bold">Plan Name</th>
              <th className="px-4 py-2 text-left font-bold">PPPoE Profile</th>
              <th className="px-4 py-2 text-left font-bold">Price</th>
              <th className="px-4 py-2 text-left font-bold">Status</th>
              <th className="px-4 py-2 text-left font-bold">Created</th>
              <th className="px-4 py-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No billing plans found.
                </td>
              </tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2 font-semibold text-slate-900">{plan.plan_name}</td>
                <td className="px-4 py-2 text-slate-700">
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold">
                    {plan.pppoe_profile}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-900 font-bold">
                  {plan.currency} {plan.price.toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold ${
                    plan.is_active === 1 
                      ? 'bg-green-50 text-green-700' 
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {plan.is_active === 1 ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(plan.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(plan)}
                      disabled={actionLoading}
                      className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id, plan.plan_name)}
                      disabled={actionLoading}
                      className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase"
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
    </div>
  );
};

export default BillingPlansPage;
