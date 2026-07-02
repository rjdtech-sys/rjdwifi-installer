import React, { useState, useEffect } from 'react';
import { Gift, Save } from 'lucide-react';
import { apiClient } from '../../lib/api';

export default function RewardsSettings() {
  const [enabled, setEnabled] = useState(false);
  const [thresholdPesos, setThresholdPesos] = useState<string>('20');
  const [rewardCreditPesos, setRewardCreditPesos] = useState<string>('1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await apiClient.getRewardsConfig();
        setEnabled(cfg.enabled);
        setThresholdPesos(String(cfg.thresholdPesos ?? 20));
        setRewardCreditPesos(String(cfg.rewardCreditPesos ?? 1));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    const t = parseInt(thresholdPesos, 10);
    const r = parseInt(rewardCreditPesos, 10);
    if (!t || t <= 0 || isNaN(t) || isNaN(r) || r < 0) {
      alert('Invalid rewards configuration.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.saveRewardsConfig(enabled, t, r);
      alert('Rewards settings saved.');
    } catch (e) {
      console.error(e);
      alert('Failed to save rewards settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
        Loading rewards settings...
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-lg text-white">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Rewards Program</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Bonus credits for loyal customers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              enabled ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            {enabled ? 'Active' : 'Disabled'}
          </span>
          <button
            onClick={() => setEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
              enabled ? 'bg-amber-500' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
            Every Purchase Of
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-500">₱</span>
            <input
              type="number"
              min={1}
              value={thresholdPesos}
              onChange={e => setThresholdPesos(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <p className="text-[9px] text-slate-400 mt-1">
            Base amount to qualify for a reward. Purchases stack automatically.
          </p>
        </div>

        <div className="col-span-1">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
            Gives Extra Credit
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-500">₱</span>
            <input
              type="number"
              min={0}
              value={rewardCreditPesos}
              onChange={e => setRewardCreditPesos(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <p className="text-[9px] text-slate-400 mt-1">
            Credit is saved to the customer wallet for future use.
          </p>
        </div>

        <div className="col-span-1 flex items-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            Save Rewards
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[9px] text-amber-800 font-bold uppercase tracking-tight">
        Example: With threshold ₱20 and reward ₱1, a customer who inserts ₱100
        will receive ₱5 bonus credit saved to their device wallet.
      </div>
    </div>
  );
}

