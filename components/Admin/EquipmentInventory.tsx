import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import { Equipment, EquipmentWithdrawal } from '../../types';

type EquipSubPage = 'inventory' | 'withdrawals';

const EQUIPMENT_TYPES: { value: Equipment['type']; label: string }[] = [
  { value: 'router', label: 'Router' },
  { value: 'access_point', label: 'Access Point' },
  { value: 'switch', label: 'Switch' },
  { value: 'cable', label: 'Cable' },
  { value: 'antenna', label: 'Antenna' },
  { value: 'other', label: 'Other' },
];

const typeBadge = (type: string) => {
  const map: Record<string, string> = {
    router: 'bg-blue-50 text-blue-700 border-blue-200',
    access_point: 'bg-purple-50 text-purple-700 border-purple-200',
    switch: 'bg-amber-50 text-amber-700 border-amber-200',
    cable: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    antenna: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    other: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return map[type] || map.other;
};

const typeLabel = (type: string) => {
  const found = EQUIPMENT_TYPES.find(t => t.value === type);
  return found ? found.label : type;
};

// ============================================
// INVENTORY LIST SUB-PAGE
// ============================================
const InventoryList: React.FC<{
  equipment: Equipment[];
  onRefresh: () => void;
  loading: boolean;
}> = ({ equipment, onRefresh, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'router' as Equipment['type'],
    serial_number: '', mac_address: '', price: '', stock: '', description: ''
  });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');

  const resetForm = () => {
    setForm({ name: '', type: 'router', serial_number: '', mac_address: '', price: '', stock: '', description: '' });
    setEditing(null);
  };
  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (item: Equipment) => {
    setEditing(item);
    setForm({
      name: item.name, type: item.type,
      serial_number: item.serial_number || '', mac_address: item.mac_address || '',
      price: String(item.price || ''), stock: String(item.stock || ''), description: item.description || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.type) { alert('Name and type are required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), type: form.type,
        serial_number: form.serial_number.trim() || null,
        mac_address: form.mac_address.trim() || null,
        price: Number(form.price) || 0, stock: Number(form.stock) || 0,
        description: form.description.trim() || null
      };
      if (editing) {
        await apiClient.updateEquipment(editing.id, payload);
      } else {
        await apiClient.createEquipment(payload as any);
      }
      setShowModal(false); resetForm(); onRefresh();
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Failed to save equipment'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (item: Equipment) => {
    if (!confirm('Delete equipment "' + item.name + '"? This cannot be undone.')) return;
    try { await apiClient.deleteEquipment(item.id); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to delete equipment')); }
  };

  const filtered = useMemo(() => {
    let result = [...equipment];
    if (filterType) result = result.filter(e => e.type === filterType);
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(term) ||
        (e.serial_number || '').toLowerCase().includes(term) ||
        (e.mac_address || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [equipment, filterType, searchTerm]);

  const totalStock = useMemo(() => filtered.reduce((sum, e) => sum + (e.stock || 0), 0), [filtered]);
  const totalValue = useMemo(() => filtered.reduce((sum, e) => sum + ((e.price || 0) * (e.stock || 0)), 0), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Equipment Inventory</h2>
          <p className="text-xs text-slate-500">Manage routers, access points, and other equipment stock.</p>
        </div>
        <button onClick={openAdd} className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>+ Add Equipment</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100 flex items-baseline gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Items</span>
          <span className="text-lg font-black text-slate-800">{filtered.length}</span>
        </div>
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100 flex items-baseline gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Stock</span>
          <span className="text-lg font-black text-blue-700">{totalStock}</span>
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl px-4 py-3 shadow-sm border border-emerald-400 flex items-baseline gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Total Value</span>
          <span className="text-lg font-black text-white">₱{totalValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filter by Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full admin-input text-xs">
              <option value="">All Types</option>
              {EQUIPMENT_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Search</label>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full admin-input text-xs" placeholder="Name, serial, MAC..." />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-[10px] uppercase tracking-widest text-slate-500">
                <th className="px-4 py-2 text-left font-bold">Name</th>
                <th className="px-4 py-2 text-left font-bold">Type</th>
                <th className="px-4 py-2 text-left font-bold">Serial No.</th>
                <th className="px-4 py-2 text-left font-bold">MAC Address</th>
                <th className="px-4 py-2 text-left font-bold">Price</th>
                <th className="px-4 py-2 text-left font-bold">Stock</th>
                <th className="px-4 py-2 text-left font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-slate-400">Loading equipment...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-slate-400">No equipment found. Add some to get started.</td></tr>}
              {!loading && filtered.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-semibold text-slate-800">{item.name}</td>
                  <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeBadge(item.type)}`}>{typeLabel(item.type)}</span></td>
                  <td className="px-4 py-2 text-[11px] font-mono text-slate-600">{item.serial_number || '-'}</td>
                  <td className="px-4 py-2 text-[11px] font-mono text-slate-600">{item.mac_address || '-'}</td>
                  <td className="px-4 py-2 text-[11px] font-semibold text-slate-700">₱{Number(item.price || 0).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      item.stock > 5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      item.stock > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>{item.stock}</span>
                  </td>
                  <td className="px-4 py-2"><div className="flex items-center gap-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold">Edit</button>
                    <button onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700 text-[11px] font-bold">Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{editing ? 'Edit Equipment' : 'Add Equipment'}</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Equipment Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full admin-input text-xs" placeholder="e.g. MikroTik hAP ac2" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Type *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Equipment['type'] })} className="w-full admin-input text-xs">
                    {EQUIPMENT_TYPES.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Serial Number</label>
                  <input type="text" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="w-full admin-input text-xs" placeholder="e.g. SN-1234567890" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">MAC Address</label>
                  <input type="text" value={form.mac_address} onChange={(e) => setForm({ ...form, mac_address: e.target.value })} className="w-full admin-input text-xs" placeholder="e.g. AA:BB:CC:DD:EE:FF" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Price (₱)</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full admin-input text-xs" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Stock Quantity</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="w-full admin-input text-xs" placeholder="0" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Description</label>
                  <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full admin-input text-xs" placeholder="Optional description..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowModal(false); resetForm(); }} className="admin-btn-secondary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="admin-btn-primary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">{saving ? 'Saving...' : (editing ? 'Update' : 'Save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// WITHDRAW EQUIPMENT SUB-PAGE
// ============================================
interface WithdrawalItem {
  equipment_id: number;
  quantity: number;
  equipment_name?: string;
  equipment_type?: string;
}

const WithdrawEquipment: React.FC<{
  equipment: Equipment[];
  withdrawals: EquipmentWithdrawal[];
  onRefresh: () => void;
  loading: boolean;
}> = ({ equipment, withdrawals, onRefresh, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    client_name: '', withdrawal_date: new Date().toISOString().slice(0, 10), notes: ''
  });
  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const resetForm = () => {
    setForm({ client_name: '', withdrawal_date: new Date().toISOString().slice(0, 10), notes: '' });
    setItems([]);
  };
  const openAdd = () => { resetForm(); setShowModal(true); };

  const addItemLine = () => {
    setItems([...items, { equipment_id: 0, quantity: 1 }]);
  };
  const removeItemLine = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };
  const updateItemLine = (index: number, field: keyof WithdrawalItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    if (!form.client_name.trim() || !form.withdrawal_date) { alert('Client name and withdrawal date are required.'); return; }
    const validItems = items.filter(i => i.equipment_id && i.quantity > 0);
    if (validItems.length === 0) { alert('Add at least one equipment item with quantity.'); return; }
    setSaving(true);
    try {
      await apiClient.createEquipmentWithdrawal({
        client_name: form.client_name.trim(),
        withdrawal_date: form.withdrawal_date,
        notes: form.notes.trim() || undefined,
        items: validItems.map(i => ({ equipment_id: i.equipment_id, quantity: i.quantity }))
      });
      setShowModal(false); resetForm(); onRefresh();
    } catch (e: any) {
      alert('Error: ' + (e?.message || 'Failed to create withdrawal'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (w: EquipmentWithdrawal) => {
    if (!confirm(`Delete withdrawal for "${w.client_name}"? Stock will be restored automatically.`)) return;
    try { await apiClient.deleteEquipmentWithdrawal(w.id); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to delete withdrawal')); }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return withdrawals;
    const term = searchTerm.trim().toLowerCase();
    return withdrawals.filter(w =>
      w.client_name.toLowerCase().includes(term) ||
      (w.notes || '').toLowerCase().includes(term) ||
      (w.items || []).some(i => (i.equipment_name || '').toLowerCase().includes(term))
    );
  }, [withdrawals, searchTerm]);

  // Available equipment for dropdown (only items with stock > 0)
  const availableEquipment = useMemo(() => equipment.filter(e => e.stock > 0), [equipment]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Withdraw Equipment</h2>
          <p className="text-xs text-slate-500">Issue equipment to clients. Stock is automatically deducted.</p>
        </div>
        <button onClick={openAdd} className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>+ Withdraw Equipment</button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Search Withdrawals</label>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full admin-input text-xs" placeholder="Search by client name, notes, equipment..." />
        </div>
      </div>

      {/* Withdrawal Cards */}
      {loading && <div className="text-center py-8 text-[11px] text-slate-400">Loading withdrawals...</div>}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-[11px] text-slate-400">
          No withdrawals found. Click "+ Withdraw Equipment" to create one.
        </div>
      )}
      {!loading && filtered.map((w) => (
        <div key={w.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div
            className="p-4 cursor-pointer hover:bg-slate-50/60 transition-colors flex items-center justify-between"
            onClick={() => setExpandedId(expandedId === w.id ? null : w.id)}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                {w.client_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-slate-800 text-sm">{w.client_name}</div>
                <div className="text-[10px] text-slate-500">
                  {w.withdrawal_date} &middot; {(w.items || []).length} item(s)
                  {(w.items || []).reduce((s, i) => s + i.quantity, 0)} unit(s)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {w.notes && <span className="text-[10px] text-slate-400 hidden md:inline">{w.notes}</span>}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(w); }}
                className="text-red-500 hover:text-red-700 text-[11px] font-bold"
              >Delete</button>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === w.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {expandedId === w.id && (w.items || []).length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/40 p-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="text-left font-bold pb-2">Equipment</th>
                    <th className="text-left font-bold pb-2">Type</th>
                    <th className="text-left font-bold pb-2">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(w.items || []).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 font-semibold text-slate-800">{item.equipment_name || `ID: ${item.equipment_id}`}</td>
                      <td className="py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeBadge(item.equipment_type || 'other')}`}>{typeLabel(item.equipment_type || 'other')}</span></td>
                      <td className="py-2 font-bold text-slate-700">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Withdraw Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Withdraw Equipment</h3>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Client Name *</label>
                  <input type="text" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="w-full admin-input text-xs" placeholder="Name of client" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Withdrawal Date *</label>
                  <input type="date" value={form.withdrawal_date} onChange={(e) => setForm({ ...form, withdrawal_date: e.target.value })} className="w-full admin-input text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notes</label>
                  <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full admin-input text-xs" placeholder="Optional notes..." />
                </div>
              </div>

              {/* Equipment Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Equipment Items</label>
                  <button type="button" onClick={addItemLine} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold">+ Add Item</button>
                </div>
                {items.length === 0 && (
                  <div className="text-center py-4 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    No items added yet. Click "+ Add Item" above.
                  </div>
                )}
                {items.map((item, index) => {
                  const selectedEquip = equipment.find(e => e.id === item.equipment_id);
                  return (
                    <div key={index} className="flex items-end gap-2 p-3 bg-slate-50 rounded-xl">
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Equipment</label>
                        <select
                          value={item.equipment_id}
                          onChange={(e) => updateItemLine(index, 'equipment_id', Number(e.target.value))}
                          className="w-full admin-input text-xs"
                        >
                          <option value={0}>Select equipment</option>
                          {availableEquipment.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({typeLabel(e.type)}) - Stock: {e.stock}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24 space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Qty</label>
                        <input
                          type="number"
                          min={1}
                          max={selectedEquip?.stock || 999}
                          value={item.quantity}
                          onChange={(e) => updateItemLine(index, 'quantity', Number(e.target.value))}
                          className="w-full admin-input text-xs"
                        />
                      </div>
                      <button onClick={() => removeItemLine(index)} className="text-red-500 hover:text-red-700 text-lg font-bold pb-1">&times;</button>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowModal(false); resetForm(); }} className="admin-btn-secondary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="admin-btn-primary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">{saving ? 'Processing...' : 'Withdraw'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const EquipmentInventory: React.FC = () => {
  const [subPage, setSubPage] = useState<EquipSubPage>('inventory');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [withdrawals, setWithdrawals] = useState<EquipmentWithdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadEquipment = async () => {
    try {
      const data = await apiClient.getEquipment();
      setEquipment(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e?.message || 'Failed to load equipment'); }
  };
  const loadWithdrawals = async () => {
    try {
      const data = await apiClient.getEquipmentWithdrawals();
      setWithdrawals(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e?.message || 'Failed to load withdrawals'); }
  };
  const loadAll = async () => {
    setLoading(true); setError('');
    await Promise.all([loadEquipment(), loadWithdrawals()]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const subPages: { key: EquipSubPage; label: string }[] = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'withdrawals', label: 'Withdraw' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Equipment Inventory</h1>
          <p className="text-xs text-slate-500">Manage equipment stock and client withdrawals.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadAll()} className="admin-btn-secondary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>Refresh</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {subPages.map((sp) => (
          <button
            key={sp.key}
            onClick={() => setSubPage(sp.key)}
            className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
              subPage === sp.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >{sp.label}</button>
        ))}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm">{error}</div>}
      <div>
        {subPage === 'inventory' && <InventoryList equipment={equipment} onRefresh={loadAll} loading={loading} />}
        {subPage === 'withdrawals' && <WithdrawEquipment equipment={equipment} withdrawals={withdrawals} onRefresh={loadAll} loading={loading} />}
      </div>
    </div>
  );
};

export default EquipmentInventory;
