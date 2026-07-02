import React, { useState, useEffect } from 'react';
import { Rate, WifiDevice, UserSession } from '../../types';
import { apiClient } from '../../lib/api';

interface Props {
  sessions?: UserSession[];
  refreshSessions?: () => void;
  refreshDevices?: () => void;
}

const DeviceManager: React.FC<Props> = ({ sessions = [], refreshSessions, refreshDevices }) => {
  const [devices, setDevices] = useState<WifiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [refreshingDevices, setRefreshingDevices] = useState<Set<string>>(new Set());
  const [pausingDevices, setPausingDevices] = useState<Set<string>>(new Set());
  const [pricingRates, setPricingRates] = useState<Rate[]>([]);

  // Edit Modal State
  const [editingDevice, setEditingDevice] = useState<WifiDevice | null>(null);
  const [editForm, setEditForm] = useState({
    customName: '',
    sessionTime: '',
    creditPesos: '',
    creditMinutes: '',
    downloadLimit: '',
    uploadLimit: ''
  });

  const [newDevice, setNewDevice] = useState({
    mac: '',
    ip: '',
    hostname: '',
    interface: '',
    ssid: '',
    signal: 0,
    customName: ''
  });

  useEffect(() => {
    fetchDevices();
    fetchPricingRates();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDevices();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchPricingRates = async () => {
    try {
      const rates = await apiClient.getRates();
      setPricingRates(Array.isArray(rates) ? rates : []);
    } catch (err) {
      console.warn('Failed to fetch pricing rates for credit calculator', err);
    }
  };

  const getSortedRates = () => {
    return [...pricingRates]
      .filter(rate => Number(rate.pesos) > 0 && Number(rate.minutes) > 0)
      .sort((a, b) => Number(b.pesos) - Number(a.pesos));
  };

  const calculateMinutesFromPesos = (pesos: number) => {
    if (!Number.isFinite(pesos) || pesos <= 0) return 0;

    const rates = getSortedRates();
    if (rates.length === 0) return 0;

    let remainingPesos = pesos;
    let totalMinutes = 0;

    for (const rate of rates) {
      const ratePesos = Number(rate.pesos);
      const rateMinutes = Number(rate.minutes);
      const times = Math.floor(remainingPesos / ratePesos);
      if (times > 0) {
        totalMinutes += times * rateMinutes;
        remainingPesos -= times * ratePesos;
      }
    }

    const smallestRate = rates[rates.length - 1];
    if (remainingPesos > 0 && smallestRate) {
      totalMinutes += Math.floor((remainingPesos / Number(smallestRate.pesos)) * Number(smallestRate.minutes));
    }

    return Math.max(0, Math.floor(totalMinutes));
  };

  const calculatePesosFromMinutes = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return 0;

    const rates = getSortedRates();
    if (rates.length === 0) return 0;

    let low = 0;
    let high = Math.max(...rates.map(rate => Number(rate.pesos)), 1);

    while (calculateMinutesFromPesos(high) < minutes) {
      high *= 2;
      if (high > 100000) break;
    }

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (calculateMinutesFromPesos(mid) >= minutes) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    return low;
  };

  const updateCreditPesos = (value: string) => {
    const pesos = Number(value);
    setEditForm(prev => ({
      ...prev,
      creditPesos: value,
      creditMinutes: value === '' ? '' : String(calculateMinutesFromPesos(pesos))
    }));
  };

  const updateCreditMinutes = (value: string) => {
    const minutes = Number(value);
    setEditForm(prev => ({
      ...prev,
      creditMinutes: value,
      creditPesos: value === '' ? '' : String(calculatePesosFromMinutes(minutes))
    }));
  };

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.scanDevices();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const scanDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.scanDevices();
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan devices');
    } finally {
      setLoading(false);
    }
  };

  const refreshDevice = async (deviceId: string) => {
    setRefreshingDevices(prev => new Set(prev).add(deviceId));
    try {
      const updatedDevice = await apiClient.refreshDevice(deviceId);
      setDevices(prev => prev.map(device =>
        device.id === deviceId ? updatedDevice : device
      ));
      if (refreshDevices) refreshDevices();
    } catch (err) {
      alert(`Failed to refresh device: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRefreshingDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(deviceId);
        return newSet;
      });
    }
  };

  const handleConnect = async (deviceId: string) => {
    try {
      await apiClient.connectDevice(deviceId);
      fetchDevices();
    } catch (err) {
      alert(`Failed to connect device: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    try {
      await apiClient.disconnectDevice(deviceId);
      fetchDevices();
    } catch (err) {
      alert(`Failed to disconnect device: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Pause/Resume using the existing session token system — does NOT touch the token itself
  const handlePauseResume = async (device: WifiDevice) => {
    // Resolve token: prefer device.sessionToken, fall back to live sessions prop
    const liveSession = sessions.find(s => s.mac.toUpperCase() === device.mac.toUpperCase());
    const token = device.sessionToken || liveSession?.token;

    if (!token) {
      alert('No active session token found for this device.');
      return;
    }

    setPausingDevices(prev => new Set(prev).add(device.id));
    try {
      if (device.isPaused) {
        await apiClient.resumeSession(token);
      } else {
        await apiClient.pauseSession(token);
      }
      // Refresh both devices and sessions so UI reflects new state
      await fetchDevices();
      if (refreshSessions) refreshSessions();
    } catch (err) {
      alert(`Failed to ${device.isPaused ? 'resume' : 'pause'} session: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPausingDevices(prev => {
        const newSet = new Set(prev);
        newSet.delete(device.id);
        return newSet;
      });
    }
  };

  const openEditModal = (device: WifiDevice) => {
    setEditingDevice(device);

    // Use live session data if available, otherwise fall back to device data
    const liveSession = sessions.find(s => s.mac.toUpperCase() === device.mac.toUpperCase());
    const displayTime = liveSession ? liveSession.remainingSeconds : device.sessionTime;

    setEditForm({
      customName: device.customName || device.hostname || '',
      sessionTime: displayTime ? Math.floor(displayTime / 60).toString() : '',
      creditPesos: device.creditPesos ? String(device.creditPesos) : '',
      creditMinutes: device.creditMinutes ? String(Math.floor(device.creditMinutes)) : '',
      downloadLimit: device.downloadLimit ? device.downloadLimit.toString() : '',
      uploadLimit: device.uploadLimit ? device.uploadLimit.toString() : ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDevice) return;

    try {
      await apiClient.updateWifiDevice(editingDevice.id, {
        customName: editForm.customName,
        sessionTime: editForm.sessionTime ? Number(editForm.sessionTime) * 60 : undefined,
        creditPesos: editForm.creditPesos === '' ? 0 : Number(editForm.creditPesos),
        creditMinutes: editForm.creditMinutes === '' ? 0 : Number(editForm.creditMinutes),
        downloadLimit: editForm.downloadLimit ? Number(editForm.downloadLimit) : 0,
        uploadLimit: editForm.uploadLimit ? Number(editForm.uploadLimit) : 0
      });
      setEditingDevice(null);
      fetchDevices();
      if (refreshSessions) refreshSessions();
    } catch (err) {
      alert(`Failed to update device: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (device: WifiDevice) => {
    const isOnline = device.isOnline ?? ((Date.now() - (device.lastSeen || 0)) < 90000);
    if (isOnline) {
      alert('This device is currently connected and will be rediscovered automatically. Disconnect it from the hotspot before deleting its record.');
      return;
    }
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
      await apiClient.deleteWifiDevice(device.id);
      fetchDevices();
    } catch (err) {
      alert(`Failed to delete device: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteAllInactive = async () => {
    // Count inactive devices first
    const inactiveDevices = devices.filter(device => {
      const liveSession = sessions.find(s => s.mac.toUpperCase() === device.mac.toUpperCase());
      const hasSessionTime = (liveSession?.remainingSeconds || device.sessionTime || 0) > 0;
      const hasCreditPesos = (device.creditPesos || 0) > 0;
      const hasCreditMinutes = (device.creditMinutes || 0) > 0;
      const isOnline = device.isOnline ?? ((Date.now() - (device.lastSeen || 0)) < 90000);
      
      return !hasSessionTime && !hasCreditPesos && !hasCreditMinutes && !isOnline;
    });

    if (inactiveDevices.length === 0) {
      alert('No inactive devices found. All devices have active sessions or credit.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${inactiveDevices.length} inactive device(s) with no session time?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const result = await apiClient.deleteInactiveWifiDevices();
      alert(`✅ Successfully deleted ${result.count} inactive device(s)`);
      fetchDevices();
      if (refreshDevices) refreshDevices();
    } catch (err) {
      alert(`Failed to delete inactive devices: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddDevice = async () => {
    if (!newDevice.mac || !newDevice.ip || !newDevice.interface) {
      alert('Please fill in required fields (MAC, IP, Interface)');
      return;
    }

    try {
      await apiClient.createWifiDevice({
        ...newDevice,
        signal: Number(newDevice.signal) || 0
      });
      setShowAddDevice(false);
      setNewDevice({ mac: '', ip: '', hostname: '', interface: '', ssid: '', signal: 0, customName: '' });
      fetchDevices();
    } catch (err) {
      alert(`Failed to add device: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading devices...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">{error}</div>
        <button
          onClick={fetchDevices}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">WiFi Device Management</h2>
        <div className="flex gap-2">
          <button
            onClick={scanDevices}
            disabled={loading}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Scan Devices'}
          </button>
          <button
            onClick={() => setShowAddDevice(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700"
          >
            Add Device
          </button>
          <button
            onClick={handleDeleteAllInactive}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700"
            title="Delete all devices with no session time, credit, or active connection"
          >
            🗑️ Delete Inactive
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editingDevice && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-tight">Edit Device</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Device Name</label>
                <input
                  type="text"
                  value={editForm.customName}
                  onChange={(e) => setEditForm({...editForm, customName: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Custom Name"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Session (Mins)</label>
                <input
                  type="number"
                  value={editForm.sessionTime}
                  onChange={(e) => setEditForm({...editForm, sessionTime: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credit (₱)</label>
                  <input
                    type="number"
                    value={editForm.creditPesos}
                    onChange={(e) => updateCreditPesos(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credit (Mins)</label>
                  <input
                    type="number"
                    value={editForm.creditMinutes}
                    onChange={(e) => updateCreditMinutes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              {pricingRates.length > 0 ? (
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Auto-calculated from Pricing tab rates.
                </p>
              ) : (
                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500">
                  No pricing rates found; credit conversion is disabled.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DL (Mbps)</label>
                  <input
                    type="number"
                    value={editForm.downloadLimit}
                    onChange={(e) => setEditForm({...editForm, downloadLimit: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">UL (Mbps)</label>
                  <input
                    type="number"
                    value={editForm.uploadLimit}
                    onChange={(e) => setEditForm({...editForm, uploadLimit: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setEditingDevice(null)}
                  className="px-4 py-2 text-slate-500 text-[10px] font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase shadow-lg shadow-blue-600/20"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Device Form */}
      {showAddDevice && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-4 uppercase tracking-tight">Add New Device</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="MAC Address"
              value={newDevice.mac}
              onChange={(e) => setNewDevice({...newDevice, mac: e.target.value})}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <input
              type="text"
              placeholder="IP Address"
              value={newDevice.ip}
              onChange={(e) => setNewDevice({...newDevice, ip: e.target.value})}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <input
              type="text"
              placeholder="Interface (e.g., wlan0)"
              value={newDevice.interface}
              onChange={(e) => setNewDevice({...newDevice, interface: e.target.value})}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddDevice}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase shadow-lg shadow-blue-600/20"
            >
              Add Device
            </button>
            <button
              onClick={() => setShowAddDevice(false)}
              className="px-4 py-2 text-slate-500 text-[10px] font-bold uppercase"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Device Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-800">Connected Devices ({devices.length})</h3>
          <button onClick={fetchDevices} className="text-[10px] font-bold text-blue-600 uppercase">Refresh All</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[9px] uppercase font-bold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-4 py-2">Device</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Network</th>
                <th className="px-4 py-2">Signal</th>
                <th className="px-4 py-2">Session</th>
                <th className="px-4 py-2">Limit</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((device) => {
                // Cross-reference live sessions prop for real-time data
                const liveSession = sessions.find(s => s.mac.toUpperCase() === device.mac.toUpperCase());
                const isDeviceActive = device.isActive || (liveSession && liveSession.remainingSeconds > 0);

                // Pause state: prefer device field (from /api/devices), fall back to sessions prop
                const isPaused = device.isPaused ?? (liveSession?.isPaused === true);

                // Online: seen within 90 seconds
                const isOnline = device.isOnline ?? ((Date.now() - (device.lastSeen || 0)) < 90000);

                // Has a session token (needed for pause/resume)
                const hasToken = Boolean(device.sessionToken || liveSession?.token);

                const isPauseLoading = pausingDevices.has(device.id);

                return (
                  <tr key={device.id} className={`hover:bg-slate-50 transition-colors ${!isDeviceActive ? 'opacity-50' : ''}`}>
                    {/* Device */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDeviceActive ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <div>
                          <div className="text-[11px] font-bold text-slate-900">
                            {device.customName || device.hostname || 'Unknown'}
                          </div>
                          <div className="text-[9px] text-slate-500 uppercase">{device.mac}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status badges */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {/* Online / Offline */}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide w-fit ${
                          isOnline
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>

                        {/* Paused / Active — only show when device has an active session */}
                        {isDeviceActive && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide w-fit ${
                            isPaused
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                            {isPaused ? 'Paused' : 'Active'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Network */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="text-[10px] font-bold text-slate-700">{device.ip || '-'}</div>
                      <div className="text-[9px] text-slate-400 uppercase tracking-tighter">{device.interface || '-'}</div>
                    </td>

                    {/* Signal */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1 h-3 rounded-full ${
                          device.signal > -50 ? 'bg-green-500' :
                          device.signal > -70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="text-[10px] font-bold text-slate-700">{device.signal} dBm</span>
                      </div>
                    </td>

                    {/* Session */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {(() => {
                        const displayTime = liveSession ? liveSession.remainingSeconds : device.sessionTime;
                        const displayPaid = liveSession ? liveSession.totalPaid : device.totalPaid;
                        const creditPesos = device.creditPesos || 0;
                        const creditMinutes = device.creditMinutes || 0;

                        return (
                          <>
                            <div className={`text-[10px] font-bold ${isPaused ? 'text-amber-600' : 'text-blue-600'}`}>
                              {displayTime ? formatTime(displayTime) : 'None'}
                              {isPaused && <span className="ml-1 text-[8px] text-amber-500">(paused)</span>}
                            </div>
                            {displayPaid ? (
                              <div className="text-[9px] text-green-600 font-bold">₱{displayPaid}</div>
                            ) : null}
                            {creditPesos > 0 || creditMinutes > 0 ? (
                              <div className="text-[9px] text-amber-600 font-bold mt-0.5">
                                Credit: ₱{creditPesos}{creditMinutes > 0 ? ` / ${creditMinutes}m` : ''}
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </td>

                    {/* Bandwidth Limit */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="text-[9px] font-bold text-slate-600">
                        <div>DL: {device.downloadLimit ? `${device.downloadLimit}M` : '∞'}</div>
                        <div>UL: {device.uploadLimit ? `${device.uploadLimit}M` : '∞'}</div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2 whitespace-nowrap text-right space-x-1">
                      {/* Refresh */}
                      <button
                        onClick={() => refreshDevice(device.id)}
                        disabled={refreshingDevices.has(device.id)}
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
                        title="Refresh"
                      >
                        {refreshingDevices.has(device.id) ? '...' : '🔄'}
                      </button>

                      {/* Pause / Resume — only when active session with token exists */}
                      {isDeviceActive && hasToken && (
                        <button
                          onClick={() => handlePauseResume(device)}
                          disabled={isPauseLoading}
                          className={`p-1.5 rounded-md transition-colors text-[10px] font-bold ${
                            isPaused
                              ? 'hover:bg-green-50 text-green-600'
                              : 'hover:bg-amber-50 text-amber-600'
                          } disabled:opacity-40`}
                          title={isPaused ? 'Resume Internet' : 'Pause Internet'}
                        >
                          {isPauseLoading ? '...' : isPaused ? '▶️' : '⏸️'}
                        </button>
                      )}

                      {/* Connect / Disconnect */}
                      {isDeviceActive ? (
                        <button
                          onClick={() => handleDisconnect(device.id)}
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                          title="Disconnect"
                        >
                          🚫
                        </button>
                      ) : (
                        <button
                          onClick={() => handleConnect(device.id)}
                          className="p-1.5 hover:bg-green-50 text-green-600 rounded-md transition-colors"
                          title="Connect"
                        >
                          ✅
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => openEditModal(device)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition-colors"
                        title="Edit"
                      >
                        ✏️
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(device)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {devices.length === 0 && (
            <div className="text-center py-10">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">No devices found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceManager;
