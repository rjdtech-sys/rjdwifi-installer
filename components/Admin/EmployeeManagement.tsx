import React, { useEffect, useState, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import { Employee, DTRRecord, PayrollRecord } from '../../types';

type EmployeeSubPage = 'employees' | 'dtr' | 'payroll';

const EmployeeList: React.FC<{
  employees: Employee[];
  onRefresh: () => void;
  loading: boolean;
}> = ({ employees, onRefresh, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ employee_code: '', full_name: '', position: '', contact_number: '', email: '', address: '', daily_rate: '', status: 'active' as 'active' | 'inactive' });
  const [saving, setSaving] = useState(false);

  const resetForm = () => { setForm({ employee_code: '', full_name: '', position: '', contact_number: '', email: '', address: '', daily_rate: '', status: 'active' }); setEditing(null); };
  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (emp: Employee) => { setEditing(emp); setForm({ employee_code: emp.employee_code, full_name: emp.full_name, position: emp.position, contact_number: emp.contact_number || '', email: emp.email || '', address: emp.address || '', daily_rate: String(emp.daily_rate || ''), status: emp.status }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.employee_code.trim() || !form.full_name.trim() || !form.position.trim()) { alert('Employee code, full name, and position are required.'); return; }
    setSaving(true);
    try {
      const payload = { employee_code: form.employee_code.trim(), full_name: form.full_name.trim(), position: form.position.trim(), contact_number: form.contact_number.trim() || null, email: form.email.trim() || null, address: form.address.trim() || null, daily_rate: Number(form.daily_rate) || 0, status: form.status };
      if (editing) { await apiClient.updateEmployee(editing.id, payload); } else { await apiClient.createEmployee(payload as any); }
      setShowModal(false); resetForm(); onRefresh();
    } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to save employee')); } finally { setSaving(false); }
  };

  const handleDelete = async (emp: Employee) => { if (!confirm('Delete employee "' + emp.full_name + '"?')) return; try { await apiClient.deleteEmployee(emp.id); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to delete employee')); } };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Employees</h2><p className="text-xs text-slate-500">Manage employee records and daily rates.</p></div>
        <button onClick={openAdd} className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>+ Add Employee</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[10px] uppercase tracking-widest text-slate-500">
              <th className="px-4 py-2 text-left font-bold">Code</th><th className="px-4 py-2 text-left font-bold">Full Name</th><th className="px-4 py-2 text-left font-bold">Position</th><th className="px-4 py-2 text-left font-bold">Contact</th><th className="px-4 py-2 text-left font-bold">Daily Rate</th><th className="px-4 py-2 text-left font-bold">Status</th><th className="px-4 py-2 text-left font-bold">Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-slate-400">Loading employees...</td></tr>}
              {!loading && employees.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-slate-400">No employees found. Add one to get started.</td></tr>}
              {!loading && employees.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-mono text-[11px] text-slate-700">{emp.employee_code}</td>
                  <td className="px-4 py-2 font-semibold text-slate-800">{emp.full_name}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-600">{emp.position}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-600">{emp.contact_number || '-'}</td>
                  <td className="px-4 py-2 text-[11px] font-semibold text-slate-700">₱{Number(emp.daily_rate || 0).toFixed(2)}</td>
                  <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${emp.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{emp.status}</span></td>
                  <td className="px-4 py-2"><div className="flex items-center gap-2"><button onClick={() => openEdit(emp)} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold">Edit</button><button onClick={() => handleDelete(emp)} className="text-red-500 hover:text-red-700 text-[11px] font-bold">Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"><div className="p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{editing ? 'Edit Employee' : 'Add Employee'}</h3><button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Employee Code *</label><input type="text" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} className="w-full admin-input text-xs" placeholder="EMP-001" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Full Name *</label><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full admin-input text-xs" placeholder="Juan Dela Cruz" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Position *</label><input type="text" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="w-full admin-input text-xs" placeholder="Cashier / Technician" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Daily Rate (₱)</label><input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} className="w-full admin-input text-xs" placeholder="500" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact Number</label><input type="text" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} className="w-full admin-input text-xs" placeholder="09xxxxxxxxx" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full admin-input text-xs" placeholder="email@example.com" /></div>
              <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Address</label><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full admin-input text-xs" placeholder="Complete address" /></div>
              <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })} className="w-full admin-input text-xs"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="flex gap-3 pt-2"><button onClick={() => { setShowModal(false); resetForm(); }} className="admin-btn-secondary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">Cancel</button><button onClick={handleSave} disabled={saving} className="admin-btn-primary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">{saving ? 'Saving...' : (editing ? 'Update' : 'Save')}</button></div>
          </div></div>
        </div>
      )}
    </div>
  );
};

const DailyTimeRecords: React.FC<{
  employees: Employee[]; dtrRecords: DTRRecord[]; onRefresh: () => void; loading: boolean;
}> = ({ employees, dtrRecords, onRefresh, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DTRRecord | null>(null);
  const [form, setForm] = useState({ employee_id: '', record_date: new Date().toISOString().slice(0, 10), time_in: '', time_out: '', status: 'present' as DTRRecord['status'], notes: '' });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');

  const resetForm = () => { setForm({ employee_id: '', record_date: new Date().toISOString().slice(0, 10), time_in: '', time_out: '', status: 'present', notes: '' }); setEditing(null); };
  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (rec: DTRRecord) => { setEditing(rec); setForm({ employee_id: String(rec.employee_id), record_date: rec.record_date, time_in: rec.time_in || '', time_out: rec.time_out || '', status: rec.status, notes: rec.notes || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.employee_id || !form.record_date) { alert('Employee and record date are required.'); return; }
    setSaving(true);
    try {
      const payload = { employee_id: Number(form.employee_id), record_date: form.record_date, time_in: form.time_in || null, time_out: form.time_out || null, status: form.status, notes: form.notes.trim() || null };
      if (editing) { await apiClient.updateDTRRecord(editing.id, payload); } else { await apiClient.createDTRRecord(payload as any); }
      setShowModal(false); resetForm(); onRefresh();
    } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to save DTR')); } finally { setSaving(false); }
  };

  const handleDelete = async (rec: DTRRecord) => { if (!confirm('Delete this DTR record?')) return; try { await apiClient.deleteDTRRecord(rec.id); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to delete DTR')); } };

  const statusBadge = (status: string) => { const map: Record<string, string> = { present: 'bg-emerald-50 text-emerald-700 border-emerald-200', absent: 'bg-red-50 text-red-700 border-red-200', late: 'bg-amber-50 text-amber-700 border-amber-200', half_day: 'bg-orange-50 text-orange-700 border-orange-200', leave: 'bg-blue-50 text-blue-700 border-blue-200' }; return map[status] || 'bg-slate-50 text-slate-600 border-slate-200'; };

  const filtered = useMemo(() => { let result = [...dtrRecords]; if (filterEmployee) result = result.filter(r => String(r.employee_id) === filterEmployee); if (searchTerm.trim()) { const term = searchTerm.trim().toLowerCase(); result = result.filter(r => (r.employee_name || '').toLowerCase().includes(term) || (r.record_date || '').includes(term)); } return result; }, [dtrRecords, filterEmployee, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Daily Time Records</h2><p className="text-xs text-slate-500">Track employee attendance, time-in and time-out.</p></div>
        <button onClick={openAdd} className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>+ Add DTR Record</button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filter by Employee</label><select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="w-full admin-input text-xs"><option value="">All Employees</option>{employees.map(emp => (<option key={emp.id} value={String(emp.id)}>{emp.full_name}</option>))}</select></div>
          <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Search</label><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full admin-input text-xs" placeholder="Search by name or date..." /></div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="overflow-x-auto">
        <table className="min-w-full text-xs"><thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[10px] uppercase tracking-widest text-slate-500">
          <th className="px-4 py-2 text-left font-bold">Employee</th><th className="px-4 py-2 text-left font-bold">Date</th><th className="px-4 py-2 text-left font-bold">Time In</th><th className="px-4 py-2 text-left font-bold">Time Out</th><th className="px-4 py-2 text-left font-bold">Hours</th><th className="px-4 py-2 text-left font-bold">Status</th><th className="px-4 py-2 text-left font-bold">Actions</th>
        </tr></thead><tbody>
          {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-slate-400">Loading DTR records...</td></tr>}
          {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-slate-400">No DTR records found.</td></tr>}
          {!loading && filtered.map((rec) => (
            <tr key={rec.id} className="border-b border-slate-50 hover:bg-slate-50/60">
              <td className="px-4 py-2 font-semibold text-slate-800">{rec.employee_name || '-'}</td>
              <td className="px-4 py-2 text-[11px] text-slate-600">{rec.record_date}</td>
              <td className="px-4 py-2 text-[11px] font-mono text-slate-700">{rec.time_in || '-'}</td>
              <td className="px-4 py-2 text-[11px] font-mono text-slate-700">{rec.time_out || '-'}</td>
              <td className="px-4 py-2 text-[11px] font-semibold text-slate-700">{Number(rec.total_hours || 0).toFixed(2)}</td>
              <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(rec.status)}`}>{rec.status}</span></td>
              <td className="px-4 py-2"><div className="flex items-center gap-2"><button onClick={() => openEdit(rec)} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold">Edit</button><button onClick={() => handleDelete(rec)} className="text-red-500 hover:text-red-700 text-[11px] font-bold">Delete</button></div></td>
            </tr>
          ))}
        </tbody></table>
      </div></div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md"><div className="p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{editing ? 'Edit DTR' : 'Add DTR'}</h3><button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button></div>
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Employee *</label><select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="w-full admin-input text-xs"><option value="">Select employee</option>{employees.map(emp => (<option key={emp.id} value={String(emp.id)}>{emp.full_name}</option>))}</select></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Date *</label><input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} className="w-full admin-input text-xs" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time In</label><input type="time" value={form.time_in} onChange={(e) => setForm({ ...form, time_in: e.target.value })} className="w-full admin-input text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Time Out</label><input type="time" value={form.time_out} onChange={(e) => setForm({ ...form, time_out: e.target.value })} className="w-full admin-input text-xs" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DTRRecord['status'] })} className="w-full admin-input text-xs"><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="half_day">Half Day</option><option value="leave">Leave</option></select></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full admin-input text-xs" placeholder="Optional notes..." /></div>
            </div>
            <div className="flex gap-3 pt-2"><button onClick={() => { setShowModal(false); resetForm(); }} className="admin-btn-secondary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">Cancel</button><button onClick={handleSave} disabled={saving} className="admin-btn-primary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">{saving ? 'Saving...' : (editing ? 'Update' : 'Save')}</button></div>
          </div></div>
        </div>
      )}
    </div>
  );
};

const PayrollGenerator: React.FC<{
  employees: Employee[]; payrollRecords: PayrollRecord[]; onRefresh: () => void; loading: boolean;
}> = ({ employees, payrollRecords, onRefresh, loading }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', period_start: '', period_end: '', deductions: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState('');

  const resetForm = () => { const today = new Date(); const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); setForm({ employee_id: '', period_start: startOfMonth.toISOString().slice(0, 10), period_end: endOfMonth.toISOString().slice(0, 10), deductions: '', notes: '' }); };
  const openAdd = () => { resetForm(); setShowModal(true); };

  const handleGenerate = async () => {
    if (!form.employee_id || !form.period_start || !form.period_end) { alert('Employee, period start, and period end are required.'); return; }
    setSaving(true);
    try { await apiClient.generatePayroll({ employee_id: Number(form.employee_id), period_start: form.period_start, period_end: form.period_end, deductions: Number(form.deductions) || 0, notes: form.notes.trim() || undefined }); setShowModal(false); resetForm(); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to generate payroll')); } finally { setSaving(false); }
  };
  const handleDelete = async (rec: PayrollRecord) => { if (!confirm('Delete this payroll record?')) return; try { await apiClient.deletePayroll(rec.id); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to delete payroll')); } };
  const handleUpdateStatus = async (rec: PayrollRecord, status: PayrollRecord['status']) => { try { await apiClient.updatePayroll(rec.id, { status }); onRefresh(); } catch (e: any) { alert('Error: ' + (e?.message || 'Failed to update status')); } };

  const statusBadge = (status: string) => { const map: Record<string, string> = { draft: 'bg-slate-100 text-slate-600 border-slate-200', approved: 'bg-blue-50 text-blue-700 border-blue-200', paid: 'bg-emerald-50 text-emerald-700 border-emerald-200' }; return map[status] || 'bg-slate-100 text-slate-600 border-slate-200'; };
  const filtered = useMemo(() => { if (!filterEmployee) return payrollRecords; return payrollRecords.filter(r => String(r.employee_id) === filterEmployee); }, [payrollRecords, filterEmployee]);
  const totals = useMemo(() => { return filtered.reduce((acc, r) => { acc.gross += r.gross_pay || 0; acc.deductions += r.deductions || 0; acc.net += r.net_pay || 0; return acc; }, { gross: 0, deductions: 0, net: 0 }); }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Payroll</h2><p className="text-xs text-slate-500">Generate and manage payroll based on DTR records.</p></div>
        <button onClick={openAdd} className="admin-btn-primary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>+ Generate Payroll</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100 flex items-baseline gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Gross</span><span className="text-lg font-black text-slate-800">₱{totals.gross.toFixed(2)}</span></div>
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100 flex items-baseline gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Deductions</span><span className="text-lg font-black text-red-600">₱{totals.deductions.toFixed(2)}</span></div>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl px-4 py-3 shadow-sm border border-emerald-400 flex items-baseline gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">Total Net Pay</span><span className="text-lg font-black text-white">₱{totals.net.toFixed(2)}</span></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filter by Employee</label><select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="w-full admin-input text-xs"><option value="">All Employees</option>{employees.map(emp => (<option key={emp.id} value={String(emp.id)}>{emp.full_name}</option>))}</select></div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"><div className="overflow-x-auto">
        <table className="min-w-full text-xs"><thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[10px] uppercase tracking-widest text-slate-500">
          <th className="px-4 py-2 text-left font-bold">Employee</th><th className="px-4 py-2 text-left font-bold">Period</th><th className="px-4 py-2 text-left font-bold">Days</th><th className="px-4 py-2 text-left font-bold">Hours</th><th className="px-4 py-2 text-left font-bold">Gross</th><th className="px-4 py-2 text-left font-bold">Deductions</th><th className="px-4 py-2 text-left font-bold">Net Pay</th><th className="px-4 py-2 text-left font-bold">Status</th><th className="px-4 py-2 text-left font-bold">Actions</th>
        </tr></thead><tbody>
          {loading && <tr><td colSpan={9} className="px-4 py-6 text-center text-[11px] text-slate-400">Loading payroll records...</td></tr>}
          {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-[11px] text-slate-400">No payroll records found.</td></tr>}
          {!loading && filtered.map((rec) => (
            <tr key={rec.id} className="border-b border-slate-50 hover:bg-slate-50/60">
              <td className="px-4 py-2 font-semibold text-slate-800">{rec.employee_name || '-'}</td>
              <td className="px-4 py-2 text-[11px] text-slate-600">{rec.period_start} → {rec.period_end}</td>
              <td className="px-4 py-2 text-[11px] text-slate-700">{rec.total_days}</td>
              <td className="px-4 py-2 text-[11px] text-slate-700">{Number(rec.total_hours || 0).toFixed(2)}</td>
              <td className="px-4 py-2 text-[11px] font-semibold text-slate-700">₱{Number(rec.gross_pay || 0).toFixed(2)}</td>
              <td className="px-4 py-2 text-[11px] font-semibold text-red-600">₱{Number(rec.deductions || 0).toFixed(2)}</td>
              <td className="px-4 py-2 text-[11px] font-bold text-emerald-700">₱{Number(rec.net_pay || 0).toFixed(2)}</td>
              <td className="px-4 py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(rec.status)}`}>{rec.status}</span></td>
              <td className="px-4 py-2"><div className="flex items-center gap-2 flex-wrap">
                {rec.status === 'draft' && <button onClick={() => handleUpdateStatus(rec, 'approved')} className="text-blue-600 hover:text-blue-800 text-[11px] font-bold">Approve</button>}
                {rec.status === 'approved' && <button onClick={() => handleUpdateStatus(rec, 'paid')} className="text-emerald-600 hover:text-emerald-800 text-[11px] font-bold">Mark Paid</button>}
                <button onClick={() => handleDelete(rec)} className="text-red-500 hover:text-red-700 text-[11px] font-bold">Delete</button>
              </div></td>
            </tr>
          ))}
        </tbody></table>
      </div></div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md"><div className="p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Generate Payroll</h3><button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button></div>
            <div className="space-y-3">
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Employee *</label><select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="w-full admin-input text-xs"><option value="">Select employee</option>{employees.map(emp => (<option key={emp.id} value={String(emp.id)}>{emp.full_name}</option>))}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Period Start *</label><input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className="w-full admin-input text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Period End *</label><input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className="w-full admin-input text-xs" /></div>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Deductions (₱)</label><input type="number" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} className="w-full admin-input text-xs" placeholder="0.00" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Notes</label><input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full admin-input text-xs" placeholder="Optional notes..." /></div>
            </div>
            <div className="flex gap-3 pt-2"><button onClick={() => { setShowModal(false); resetForm(); }} className="admin-btn-secondary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">Cancel</button><button onClick={handleGenerate} disabled={saving} className="admin-btn-primary flex-1 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest">{saving ? 'Generating...' : 'Generate'}</button></div>
          </div></div>
        </div>
      )}
    </div>
  );
};

const EmployeeManagement: React.FC = () => {
  const [subPage, setSubPage] = useState<EmployeeSubPage>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dtrRecords, setDtrRecords] = useState<DTRRecord[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadEmployees = async () => { try { const data = await apiClient.getEmployees(); setEmployees(Array.isArray(data) ? data : []); } catch (e: any) { setError(e?.message || 'Failed to load employees'); } };
  const loadDTR = async () => { try { const data = await apiClient.getDTRRecords(); setDtrRecords(Array.isArray(data) ? data : []); } catch (e: any) { setError(e?.message || 'Failed to load DTR records'); } };
  const loadPayroll = async () => { try { const data = await apiClient.getPayrollRecords(); setPayrollRecords(Array.isArray(data) ? data : []); } catch (e: any) { setError(e?.message || 'Failed to load payroll records'); } };
  const loadAll = async () => { setLoading(true); setError(''); await Promise.all([loadEmployees(), loadDTR(), loadPayroll()]); setLoading(false); };

  useEffect(() => { loadAll(); }, []);

  const subPages: { key: EmployeeSubPage; label: string }[] = [
    { key: 'employees', label: 'Employees' },
    { key: 'dtr', label: 'Daily Time Records' },
    { key: 'payroll', label: 'Payroll' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Employee Management</h1><p className="text-xs text-slate-500">Manage employees, daily time records, and payroll.</p></div>
        <div className="flex items-center gap-2"><button onClick={() => loadAll()} className="admin-btn-secondary px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest" disabled={loading}>Refresh</button></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {subPages.map((sp) => (<button key={sp.key} onClick={() => setSubPage(sp.key)} className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${subPage === sp.key ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{sp.label}</button>))}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm">{error}</div>}
      <div>
        {subPage === 'employees' && <EmployeeList employees={employees} onRefresh={loadAll} loading={loading} />}
        {subPage === 'dtr' && <DailyTimeRecords employees={employees} dtrRecords={dtrRecords} onRefresh={loadAll} loading={loading} />}
        {subPage === 'payroll' && <PayrollGenerator employees={employees} payrollRecords={payrollRecords} onRefresh={loadAll} loading={loading} />}
      </div>
    </div>
  );
};

export default EmployeeManagement;
