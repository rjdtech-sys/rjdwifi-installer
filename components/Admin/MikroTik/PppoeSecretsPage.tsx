import React, { useMemo, useState, useEffect } from 'react';
import { apiClient } from '../../../lib/api';
import { MikrotikBillingData } from '../../../types';
import PayModal from './PayModal';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
  routerId: string;
  onRefresh: () => void;
};

const PppoeSecretsPage: React.FC<Props> = ({ billing, loading, routerId, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    billing_plan_id: '',
    pppoe_profile: '',
    expired_profile: '',
    service: 'any',
    comment: '',
    duedate: ''
  });

  const filteredSecrets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = billing?.ppp_secrets || [];
    if (!q) return rows;
    return rows.filter((r: any) => String(r.name || '').toLowerCase().includes(q));
  }, [billing, search]);

  useEffect(() => {
    if (routerId) {
      loadBillingPlans();
      loadProfiles();
    }
  }, [routerId]);

  const loadBillingPlans = async () => {
    try {
      const plans = await apiClient.getMikrotikBillingPlans(routerId);
      setBillingPlans(Array.isArray(plans) ? plans.filter((p: any) => p.is_active === 1) : []);
    } catch (e: any) {
      console.error('Failed to load billing plans:', e);
    }
  };

  const loadProfiles = async () => {
    try {
      const profs = await apiClient.getMikrotikProfiles(routerId);
      setProfiles(Array.isArray(profs) ? profs : []);
    } catch (e: any) {
      console.error('Failed to load profiles:', e);
    }
  };

  const handlePayClick = (secret: any) => {
    setSelectedSecret(secret);
    setPayModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    onRefresh();
    alert('Payment processed successfully!');
  };

  const resetForm = () => {
    setFormData({ name: '', password: '', billing_plan_id: '', pppoe_profile: '', expired_profile: '', service: 'any', comment: '', duedate: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.password) {
      alert('Username and password are required');
      return;
    }
    if (!formData.billing_plan_id) {
      alert('Please select a billing plan');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.createMikrotikSecret(routerId, {
        name: formData.name,
        password: formData.password,
        billing_plan_id: formData.billing_plan_id,
        pppoe_profile: formData.pppoe_profile,
        expired_profile: formData.expired_profile,
        service: formData.service,
        comment: formData.comment,
        duedate: formData.duedate || null
      });
      resetForm();
      onRefresh();
      alert('Secret created successfully with scheduler');
    } catch (e: any) {
      alert(e?.message || 'Failed to create secret');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (secret: any) => {
    setFormData({
      name: secret.name || '',
      password: '',
      billing_plan_id: secret.billing_plan_id || '',
      pppoe_profile: secret.profile || '',
      expired_profile: secret.expired_profile || '',
      service: secret.service || 'any',
      comment: secret.comment || '',
      duedate: secret.duedate || ''
    });
    setEditingId(secret['.id'] || secret.id);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setActionLoading(true);
    try {
      const updateData: any = {};
      if (formData.password) updateData.password = formData.password;
      if (formData.profile) updateData.profile = formData.profile;
      if (formData.service) updateData.service = formData.service;
      updateData.disabled = formData.disabled;
      updateData.comment = formData.comment;
      
      await apiClient.updateMikrotikSecret(routerId, editingId, updateData);
      resetForm();
      onRefresh();
      alert('Secret updated successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to update secret');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (secretId: string, username: string) => {
    if (!confirm(`Delete secret "${username}"?`)) return;
    setActionLoading(true);
    try {
      await apiClient.deleteMikrotikSecret(routerId, secretId);
      onRefresh();
      alert('Secret deleted successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete secret');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PPPoE</div>
          <div className="text-sm font-bold text-slate-900">Secrets / Users</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="admin-input text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username"
            disabled={!billing || loading}
          />
          <button
            onClick={() => setShowForm(true)}
            disabled={!routerId || actionLoading}
            className="admin-btn-primary px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
          >
            Add Secret
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="text-xs font-bold text-slate-900 mb-3">
            {editingId ? 'Edit Secret' : 'New Secret'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="admin-input text-xs"
              placeholder="Username *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!!editingId || actionLoading}
            />
            <input
              className="admin-input text-xs"
              type="password"
              placeholder={editingId ? 'Password (leave blank to keep current)' : 'Password *'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={actionLoading}
            />
            <select
              className="admin-input text-xs"
              value={formData.billing_plan_id}
              onChange={(e) => {
                const selectedPlan = billingPlans.find(p => p.id === e.target.value);
                setFormData({ 
                  ...formData, 
                  billing_plan_id: e.target.value,
                  pppoe_profile: selectedPlan ? selectedPlan.pppoe_profile : ''
                });
              }}
              disabled={actionLoading || billingPlans.length === 0}
            >
              <option value="">Select Billing Plan *</option>
              {billingPlans.map((plan: any) => (
                <option key={plan.id} value={plan.id}>
                  {plan.plan_name} - {plan.currency} {plan.price.toFixed(2)}
                </option>
              ))}
            </select>
            <input
              className="admin-input text-xs"
              placeholder="PPPoE Profile (auto-filled from plan)"
              value={formData.pppoe_profile}
              onChange={(e) => setFormData({ ...formData, pppoe_profile: e.target.value })}
              disabled={actionLoading}
              readOnly
            />
            <select
              className="admin-input text-xs"
              value={formData.expired_profile}
              onChange={(e) => setFormData({ ...formData, expired_profile: e.target.value })}
              disabled={actionLoading}
            >
              <option value="">Select Expired Profile (optional)</option>
              {(billing?.ppp_profiles || []).map((p: any, idx: number) => (
                <option key={idx} value={p.name || p['name']}>
                  {p.name || 'N/A'} (Expired)
                </option>
              ))}
            </select>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase text-slate-600">Due Date</label>
              <input
                className="admin-input text-xs"
                type="datetime-local"
                value={formData.duedate}
                onChange={(e) => setFormData({ ...formData, duedate: e.target.value })}
                disabled={actionLoading}
              />
            </div>
            <select
              className="admin-input text-xs"
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value })}
              disabled={actionLoading}
            >
              <option value="any">any</option>
              <option value="pppoe">pppoe</option>
            </select>
            <input
              className="admin-input text-xs"
              placeholder="Comment"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              disabled={actionLoading}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              disabled={actionLoading || !formData.name}
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

      {!!(billing?.errors && billing.errors.length > 0) && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-[11px]">
          {billing.errors[0]}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-2 text-left font-bold">Username</th>
              <th className="px-4 py-2 text-left font-bold">Profile</th>
              <th className="px-4 py-2 text-left font-bold">Service</th>
              <th className="px-4 py-2 text-left font-bold">Disabled</th>
              <th className="px-4 py-2 text-left font-bold">Comment</th>
              <th className="px-4 py-2 text-left font-bold">Next Due Date</th>
              <th className="px-4 py-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!billing || filteredSecrets.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No secrets found.
                </td>
              </tr>
            )}
            {billing && filteredSecrets.map((r: any, idx: number) => {
              // Format due date if exists
              const formatDueDate = (dueDateStr: string) => {
                if (!dueDateStr) return null;
                const date = new Date(dueDateStr);
                const now = new Date();
                const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                let colorClass = 'text-slate-600';
                if (diffDays < 0) colorClass = 'text-red-600 font-semibold'; // Overdue
                else if (diffDays <= 3) colorClass = 'text-orange-600 font-semibold'; // Expiring soon
                else if (diffDays <= 7) colorClass = 'text-yellow-600'; // Warning
                
                const formatted = date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                const time = date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                return (
                  <div className={colorClass}>
                    <div>{formatted}</div>
                    <div className="text-[10px] opacity-75">{time}</div>
                  </div>
                );
              };

              return (
                <tr key={(r['.id'] || r.id || r.name || 'row') + idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-semibold text-slate-900">{r.name || 'N/A'}</td>
                  <td className="px-4 py-2 text-slate-700">{r.profile || 'N/A'}</td>
                  <td className="px-4 py-2 text-slate-700">{r.service || 'N/A'}</td>
                  <td className="px-4 py-2 text-slate-700">{String(r.disabled || '')}</td>
                  <td className="px-4 py-2 text-slate-600">{r.comment || ''}</td>
                  <td className="px-4 py-2">
                    {formatDueDate(r.duedate) || <span className="text-slate-400">Not set</span>}
                  </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePayClick(r)}
                      disabled={actionLoading}
                      className="text-green-600 hover:text-green-800 text-[10px] font-bold uppercase"
                    >
                      Pay
                    </button>
                    <button
                      onClick={() => handleEdit(r)}
                      disabled={actionLoading}
                      className="text-blue-600 hover:text-blue-800 text-[10px] font-bold uppercase"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r['.id'] || r.id, r.name)}
                      disabled={actionLoading}
                      className="text-red-600 hover:text-red-800 text-[10px] font-bold uppercase"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pay Modal */}
      {selectedSecret && (
        <PayModal
          isOpen={payModalOpen}
          onClose={() => {
            setPayModalOpen(false);
            setSelectedSecret(null);
          }}
          secret={selectedSecret}
          billingPlans={billingPlans}
          profiles={profiles}
          routerId={routerId}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default PppoeSecretsPage;

