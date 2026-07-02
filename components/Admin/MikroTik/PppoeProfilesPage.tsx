import React, { useState } from 'react';
import { apiClient } from '../../../lib/api';
import { MikrotikBillingData } from '../../../types';

type Props = {
  billing: MikrotikBillingData | null;
  loading: boolean;
  routerId: string;
  onRefresh: () => void;
};

const PppoeProfilesPage: React.FC<Props> = ({ billing, loading, routerId, onRefresh }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    'rate-limit': '',
    'local-address': '',
    'remote-address': '',
    'only-one': 'false',
    comment: ''
  });

  const rows = billing?.ppp_profiles || [];

  const resetForm = () => {
    setFormData({ name: '', 'rate-limit': '', 'local-address': '', 'remote-address': '', 'only-one': 'false', comment: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formData.name) {
      alert('Profile name is required');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.createMikrotikProfile(routerId, formData);
      resetForm();
      onRefresh();
      alert('Profile created successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to create profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (profile: any) => {
    setFormData({
      name: profile.name || '',
      'rate-limit': profile['rate-limit'] || profile.rate_limit || '',
      'local-address': profile['local-address'] || profile.local_address || '',
      'remote-address': profile['remote-address'] || profile.remote_address || '',
      'only-one': String(profile['only-one'] || profile.only_one || 'false'),
      comment: profile.comment || ''
    });
    setEditingId(profile['.id'] || profile.id);
    setShowForm(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setActionLoading(true);
    try {
      const updateData: any = {};
      if (formData['rate-limit']) updateData['rate-limit'] = formData['rate-limit'];
      if (formData['local-address']) updateData['local-address'] = formData['local-address'];
      if (formData['remote-address']) updateData['remote-address'] = formData['remote-address'];
      updateData['only-one'] = formData['only-one'];
      updateData.comment = formData.comment;
      
      await apiClient.updateMikrotikProfile(routerId, editingId, updateData);
      resetForm();
      onRefresh();
      alert('Profile updated successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to update profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (profileId: string, profileName: string) => {
    if (!confirm(`Delete profile "${profileName}"?`)) return;
    setActionLoading(true);
    try {
      await apiClient.deleteMikrotikProfile(routerId, profileId);
      onRefresh();
      alert('Profile deleted successfully');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete profile');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PPPoE</div>
          <div className="text-sm font-bold text-slate-900">Profiles</div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!routerId || actionLoading}
          className="admin-btn-primary px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest"
        >
          Add Profile
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="text-xs font-bold text-slate-900 mb-3">
            {editingId ? 'Edit Profile' : 'New Profile'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="admin-input text-xs"
              placeholder="Profile Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!!editingId || actionLoading}
            />
            <input
              className="admin-input text-xs"
              placeholder="Rate Limit (e.g., 10M/10M)"
              value={formData['rate-limit']}
              onChange={(e) => setFormData({ ...formData, 'rate-limit': e.target.value })}
              disabled={actionLoading}
            />
            <input
              className="admin-input text-xs"
              placeholder="Local Address"
              value={formData['local-address']}
              onChange={(e) => setFormData({ ...formData, 'local-address': e.target.value })}
              disabled={actionLoading}
            />
            <input
              className="admin-input text-xs"
              placeholder="Remote Address"
              value={formData['remote-address']}
              onChange={(e) => setFormData({ ...formData, 'remote-address': e.target.value })}
              disabled={actionLoading}
            />
            <select
              className="admin-input text-xs"
              value={formData['only-one']}
              onChange={(e) => setFormData({ ...formData, 'only-one': e.target.value })}
              disabled={actionLoading}
            >
              <option value="false">Multiple Sessions</option>
              <option value="true">Only One</option>
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
              <th className="px-4 py-2 text-left font-bold">Name</th>
              <th className="px-4 py-2 text-left font-bold">Rate Limit</th>
              <th className="px-4 py-2 text-left font-bold">Local Address</th>
              <th className="px-4 py-2 text-left font-bold">Remote Address</th>
              <th className="px-4 py-2 text-left font-bold">Only One</th>
              <th className="px-4 py-2 text-left font-bold">Comment</th>
              <th className="px-4 py-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!billing || rows.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[11px] text-slate-500">
                  No profiles found.
                </td>
              </tr>
            )}
            {billing && rows.map((r: any, idx: number) => (
              <tr key={(r['.id'] || r.id || r.name || 'row') + idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-4 py-2 font-semibold text-slate-900">{r.name || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r['rate-limit'] || r.rate_limit || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r['local-address'] || r.local_address || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{r['remote-address'] || r.remote_address || 'N/A'}</td>
                <td className="px-4 py-2 text-slate-700">{String(r['only-one'] || r.only_one || '')}</td>
                <td className="px-4 py-2 text-slate-600">{r.comment || ''}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PppoeProfilesPage;

