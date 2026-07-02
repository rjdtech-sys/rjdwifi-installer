
import React, { useState } from 'react';
import { Rate } from '../../types';
import { apiClient } from '../../lib/api';

interface Props {
  rates: Rate[];
  setRates: () => Promise<void>;
}

const RatesManager: React.FC<Props> = ({ rates, setRates }) => {
  const [newPeso, setNewPeso] = useState('');
  const [newDurationValue, setNewDurationValue] = useState('');
  const [newDurationUnit, setNewDurationUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [newExpirationValue, setNewExpirationValue] = useState('');
  const [newExpirationUnit, setNewExpirationUnit] = useState<'hours' | 'days'>('hours');
  const [rateMode, setRateMode] = useState<'pausable' | 'consumable'>('pausable');
  const [loading, setLoading] = useState(false);

  const addRate = async () => {
    if (!newPeso || !newDurationValue) return;
    setLoading(true);
    try {
      let minutes = 0;
      const durationValue = parseInt(newDurationValue, 10);
      if (!isNaN(durationValue) && durationValue > 0) {
        if (newDurationUnit === 'minutes') {
          minutes = durationValue;
        } else if (newDurationUnit === 'hours') {
          minutes = durationValue * 60;
        } else {
          minutes = durationValue * 60 * 24;
        }
      }

      let expiration_hours: number | undefined;
      if (rateMode === 'pausable' && newExpirationValue) {
        const value = parseInt(newExpirationValue, 10);
        if (!isNaN(value) && value > 0) {
          expiration_hours = newExpirationUnit === 'days' ? value * 24 : value;
        }
      }

      await apiClient.addRate(
        parseInt(newPeso), 
        minutes,
        expiration_hours,
        rateMode
      );
      await setRates();
      setNewPeso('');
      setNewDurationValue('');
      setNewDurationUnit('minutes');
      setNewExpirationValue('');
      setNewExpirationUnit('hours');
      setRateMode('pausable');
    } finally {
      setLoading(false);
    }
  };

  const deleteRate = async (id: string) => {
    if (!confirm('Are you sure you want to remove this rate?')) return;
    await apiClient.deleteRate(id);
    await setRates();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Create Rate Definition</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Currency (₱)</label>
            <input 
              type="number" 
              value={newPeso}
              onChange={(e) => setNewPeso(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Duration</label>
            <div className="flex gap-2">
            <input 
              type="number" 
              value={newDurationValue}
              onChange={(e) => setNewDurationValue(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
              placeholder="10"
            />
              <select
                value={newDurationUnit}
                onChange={(e) => setNewDurationUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                className="px-2 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mode</label>
            <select
              value={rateMode}
              onChange={(e) => setRateMode(e.target.value as 'pausable' | 'consumable')}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest"
            >
              <option value="pausable">Pausable</option>
              <option value="consumable">Consumable</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiration (Optional)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={newExpirationValue}
                onChange={(e) => setNewExpirationValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                placeholder="e.g. 24"
                min={1}
                disabled={rateMode === 'consumable'}
              />
              <select
                value={newExpirationUnit}
                onChange={(e) => setNewExpirationUnit(e.target.value as 'hours' | 'days')}
                className="px-2 py-2 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest"
                disabled={rateMode === 'consumable'}
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button 
            onClick={addRate}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10 disabled:opacity-50 h-[38px]"
          >
            {loading ? '...' : 'Add Rate'}
          </button>
        </div>
        <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <p className="text-amber-800 text-[10px] font-bold">
            ⚠️ Limits are in the <span className="font-black">Bandwidth</span> section
          </p>
        </div>
      </div>

      {/* Rates List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
          <thead className="bg-slate-50 text-[9px] text-slate-400 uppercase font-black tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-4 py-3">Denomination</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Expiration</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rates.length > 0 ? rates.sort((a,b) => a.pesos - b.pesos).map((rate) => (
              <tr key={rate.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-2">
                  <span className="font-black text-slate-900 text-sm">₱{rate.pesos}</span>
                </td>
                <td className="px-4 py-2 text-slate-600 font-bold text-xs">
                  {rate.minutes >= 60 
                    ? `${Math.floor(rate.minutes / 60)}h ${rate.minutes % 60 > 0 ? (rate.minutes % 60) + 'm' : ''}`
                    : `${rate.minutes}m`}
                </td>
                <td className="px-4 py-2 text-slate-600 font-bold text-xs">
                  {rate.expiration_hours
                    ? rate.expiration_hours % 24 === 0
                      ? `${rate.expiration_hours / 24}d`
                      : `${rate.expiration_hours}h`
                    : 'None'}
                </td>
                <td className="px-4 py-2 text-right">
                  <button 
                    onClick={() => deleteRate(rate.id)}
                    className="text-red-500 hover:text-red-700 text-[9px] font-black uppercase tracking-widest transition-colors group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-[10px] font-black uppercase">No rates defined.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default RatesManager;
