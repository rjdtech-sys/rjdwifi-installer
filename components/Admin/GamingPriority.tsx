import React, { useState, useEffect } from 'react';
import { Gamepad2, Plus, Trash2, Save, Activity } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface GamingRule {
  id: number;
  name: string;
  protocol: 'tcp' | 'udp' | 'both';
  port_start: number;
  port_end: number;
  enabled: number;
}

export default function GamingPriority() {
  const [enabled, setEnabled] = useState(false);
  const [percentage, setPercentage] = useState(20);
  const [rules, setRules] = useState<GamingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Rule State
  const [newName, setNewName] = useState('');
  const [newProtocol, setNewProtocol] = useState<'tcp' | 'udp' | 'both'>('udp');
  const [newPortStart, setNewPortStart] = useState('');
  const [newPortEnd, setNewPortEnd] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const config = await apiClient.getGamingConfig();
      const rulesData = await apiClient.getGamingRules();
      setEnabled(config.enabled);
      setPercentage(config.percentage);
      setRules(rulesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await apiClient.saveGamingConfig(enabled, percentage);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    if (!newName || !newPortStart || !newPortEnd) return;
    setSaving(true);
    try {
      await apiClient.addGamingRule(newName, newProtocol, parseInt(newPortStart), parseInt(newPortEnd));
      await loadData();
      setNewName('');
      setNewPortStart('');
      setNewPortEnd('');
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm('Remove this rule?')) return;
    setSaving(true);
    try {
      await apiClient.deleteGamingRule(id);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Gamepad2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Gaming Priority</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Low Latency Traffic Control</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${enabled ? 'text-indigo-600' : 'text-slate-400'}`}>
            {enabled ? 'Active' : 'Disabled'}
          </span>
          <button
            onClick={() => {
              const newState = !enabled;
              setEnabled(newState);
              // Auto-save on toggle
              apiClient.saveGamingConfig(newState, percentage).catch(() => setEnabled(!newState));
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              enabled ? 'bg-indigo-600' : 'bg-slate-200'
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

      {/* Bandwidth Control */}
      <div className={`space-y-4 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Total Bandwidth Reservation
            </label>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
              {percentage}% of Capacity
            </span>
          </div>
          <input
            type="range"
            min="5"
            max="80"
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value))}
            onMouseUp={saveConfig}
            onTouchEnd={saveConfig}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Allocates a guaranteed percentage of total internet bandwidth for gaming traffic to prevent lag during heavy usage.
          </p>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Rules List */}
        <div>
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3">Priority Rules</h4>
          
          <div className="space-y-2 mb-4">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 group hover:border-indigo-100 transition-all">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white rounded border border-slate-200 text-slate-400">
                    <Activity size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700">{rule.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {rule.protocol.toUpperCase()} : {rule.port_start === rule.port_end ? rule.port_start : `${rule.port_start}-${rule.port_end}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add Rule Form */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="grid grid-cols-12 gap-2 mb-2">
              <div className="col-span-12 sm:col-span-4">
                <input
                  type="text"
                  placeholder="Game Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <select
                  value={newProtocol}
                  onChange={(e) => setNewProtocol(e.target.value as any)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="udp">UDP</option>
                  <option value="tcp">TCP</option>
                  <option value="both">BOTH</option>
                </select>
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  placeholder="Start Port"
                  value={newPortStart}
                  onChange={(e) => setNewPortStart(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  type="number"
                  placeholder="End Port"
                  value={newPortEnd}
                  onChange={(e) => setNewPortEnd(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="col-span-12 sm:col-span-2">
                <button
                  onClick={addRule}
                  disabled={!newName || !newPortStart || !newPortEnd || saving}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 text-center">
              Enter port ranges found in game documentation. Most mobile games use UDP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
