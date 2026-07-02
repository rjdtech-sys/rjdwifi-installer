import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

const SystemSettings: React.FC = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [systemStats, setSystemStats] = useState({
    uptime: 'Loading...',
    memory: 'Loading...',
    cpu: 'Loading...',
    disk: 'Loading...'
  });
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [serviceStatus, setServiceStatus] = useState({
    phoneRental: { enabled: true, activeIntervals: 0 },
    mikrotik: { enabled: true, activeConnections: 0, activeIntervals: 0 }
  });
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await apiClient.getSystemStats();
        setSystemStats({
          uptime: 'System Online',
          memory: `${(stats.memory.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(stats.memory.total / 1024 / 1024 / 1024).toFixed(1)}GB (${stats.memory.percentage}%)`,
          cpu: `${stats.cpu.load}% Load`,
          disk: `${(stats.storage.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(stats.storage.total / 1024 / 1024 / 1024).toFixed(1)}GB`
        });
      } catch (e) {
        console.error('Failed to fetch system stats', e);
      }

      // Check for pending updates
      try {
          const updateData = await apiClient.getPendingUpdate();
          if (updateData && updateData.available) {
              setPendingUpdate(updateData.update);
          } else {
              setPendingUpdate(null);
          }
      } catch (e) {
          console.error('Failed to fetch pending updates', e);
      }
    };

    fetchStats();
    
    // Fetch service status
    fetchServiceStatus();
    
    const interval = setInterval(fetchStats, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleAcceptUpdate = async () => {
      if (!confirm('Are you sure you want to install this update? The system will reboot.')) return;
      
      setIsUpdating(true);
      try {
          await apiClient.acceptUpdate();
          alert('Update started! System will reboot shortly.');
          setPendingUpdate(null);
      } catch (e: any) {
          alert('Failed to start update: ' + e.message);
      } finally {
          setIsUpdating(false);
      }
  };

  const handleRejectUpdate = async () => {
      if (!confirm('Reject this update?')) return;
      
      try {
          await apiClient.rejectUpdate();
          setPendingUpdate(null);
      } catch (e: any) {
          alert('Failed to reject update: ' + e.message);
      }
  };

  // Fetch service status
  const fetchServiceStatus = async () => {
    try {
      const status = await apiClient.getSystemServices();
      setServiceStatus(status);
    } catch (e) {
      console.error('Failed to fetch service status', e);
    }
  };

  // Toggle service
  const handleToggleService = async (service: 'phoneRental' | 'mikrotik', enabled: boolean) => {
    if (isToggling) return;
    
    const serviceName = service === 'phoneRental' ? 'Phone Rental' : 'MikroTik';
    if (!confirm(`${enabled ? 'Enable' : 'Disable'} ${serviceName} service?\n\n${
      enabled 
        ? 'This will start the service and consume additional CPU/memory.' 
        : 'This will stop the service to free up CPU/memory on your SBC board.'
    }`)) {
      return;
    }

    setIsToggling(true);
    try {
      if (service === 'phoneRental') {
        await apiClient.togglePhoneRentalService(enabled);
      } else {
        await apiClient.toggleMikroTikService(enabled);
      }
      
      alert(`✅ ${serviceName} service ${enabled ? 'enabled' : 'disabled'} successfully`);
      await fetchServiceStatus();
    } catch (e: any) {
      alert(`Failed to ${enabled ? 'enable' : 'disable'} ${serviceName}: ` + e.message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== 'FACTORY RESET') return;
    
    setIsResetting(true);
    setShowConfirm(false);
    
    try {
      await apiClient.factoryReset();
      alert('Factory reset complete. All databases, network settings, and configurations have been wiped. The system will now reboot.');
      // Trigger a hard reboot after factory reset
      try {
        await fetch('/api/system/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('rjd_admin_token')}` },
          body: JSON.stringify({ type: 'hard' })
        });
      } catch (e) {}
      window.location.reload();
    } catch (e: any) {
      console.error('Reset fetch error:', e);
      alert('Reset failed: ' + (e.message || 'Unknown server error'));
    } finally {
      setIsResetting(false);
      setConfirmText('');
    }
  };

  const handleServiceAction = async (action: string, payload: any = null) => {
    if (action === 'export-db') {
        try {
            const token = localStorage.getItem('rjd_admin_token');
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            const res = await fetch('/api/system/export-db', { headers });
            
            if (res.status === 401) {
                alert('Unauthorized. Please login again.');
                return;
            }
            
            if (!res.ok) throw new Error('Download failed');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pisowifi_backup.sqlite';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e: any) {
            alert('Export failed: ' + e.message);
        }
        return;
    }

    if (action !== 'restart' && !confirm(`Are you sure you want to ${action.replace('-', ' ')}?`)) return;
    
    try {
      let endpoint = '';
      let method = 'POST';
      let body = payload ? JSON.stringify(payload) : undefined;
      
      switch (action) {
        case 'restart': endpoint = '/api/system/restart'; break;
        case 'clear-logs': endpoint = '/api/system/clear-logs'; break;
        case 'sync': endpoint = '/api/system/sync'; break;
        case 'kernel-check': 
          endpoint = '/api/system/kernel-check'; 
          method = 'GET';
          break;
      }
      
      const token = localStorage.getItem('rjd_admin_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (body) {
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(endpoint, { 
        method,
        headers,
        body
      });
      const data = await res.json();
      
      if (data.success) {
        if (action === 'kernel-check' && data.kernel) {
            alert(`Kernel Version: ${data.kernel}`);
        } else {
            alert(data.message || 'Action completed successfully');
        }
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e: any) {
      alert('Failed: ' + e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="admin-heading">System Management</h2>
        <p className="admin-subheading">Control your machine performance and maintenance</p>
      </div>

      {/* Pending Update Banner */}
      {pendingUpdate && (
        <section className="bg-indigo-600 rounded-xl border border-indigo-500 shadow-lg shadow-indigo-500/20 overflow-hidden text-white animate-pulse-slow">
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl backdrop-blur-sm">
                        🚀
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Update Available</h3>
                        <p className="text-[10px] font-medium opacity-90">
                            Version: <span className="font-mono bg-black/20 px-1 rounded">{pendingUpdate.payload?.version || 'Latest'}</span> • 
                            File: <span className="font-mono opacity-80">{pendingUpdate.payload?.file_name || 'System Update'}</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={handleRejectUpdate}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 font-bold text-[10px] uppercase transition-colors"
                    >
                        Dismiss
                    </button>
                    <button 
                        onClick={handleAcceptUpdate}
                        disabled={isUpdating}
                        className="flex-1 sm:flex-none px-6 py-2 rounded-lg bg-white text-indigo-600 font-black text-[10px] uppercase shadow-lg hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-70"
                    >
                        {isUpdating ? 'Starting...' : 'Install Update'}
                    </button>
                </div>
            </div>
        </section>
      )}

      {/* Stats Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Uptime', value: systemStats.uptime, icon: '⏱️', color: 'bg-blue-50 text-blue-600' },
          { label: 'CPU Load', value: systemStats.cpu, icon: '🧠', color: 'bg-purple-50 text-purple-600' },
          { label: 'Memory', value: systemStats.memory, icon: '💾', color: 'bg-amber-50 text-amber-600' },
          { label: 'Storage', value: systemStats.disk, icon: '💿', color: 'bg-emerald-50 text-emerald-600' }
        ].map((stat, idx) => (
          <div key={idx} className="admin-card !p-5 flex flex-col gap-3">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-xl`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">{stat.label}</p>
              <p className="text-sm font-bold text-slate-800 tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Service Toggle Controls */}
      <section className="admin-card">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">⚡</span>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Service Management</h3>
          <span className="text-[9px] text-slate-400 font-bold ml-auto">Toggle services to optimize SBC performance</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Phone Rental Service */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg">
                  📱
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">Phone Rental</h4>
                  <p className="text-[9px] text-slate-500 font-medium">
                    {serviceStatus.phoneRental.enabled ? 'Running' : 'Stopped'} • 
                    {serviceStatus.phoneRental.activeIntervals > 0 
                      ? `${serviceStatus.phoneRental.activeIntervals} active tasks` 
                      : 'Idle'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggleService('phoneRental', !serviceStatus.phoneRental.enabled)}
                disabled={isToggling}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  serviceStatus.phoneRental.enabled 
                    ? 'bg-blue-600 shadow-md shadow-blue-600/30' 
                    : 'bg-slate-300'
                } disabled:opacity-50`}
              >
                <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  serviceStatus.phoneRental.enabled ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </button>
            </div>
            <div className="text-[9px] text-slate-600 font-medium bg-white/60 rounded-lg p-2">
              {serviceStatus.phoneRental.enabled 
                ? '✅ Active: Phone rental devices can connect and rent'
                : '⏸️ Disabled: Frees CPU/memory for core WiFi services'}
            </div>
          </div>

          {/* MikroTik Service */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white text-lg">
                  🌐
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">MikroTik</h4>
                  <p className="text-[9px] text-slate-500 font-medium">
                    {serviceStatus.mikrotik.enabled ? 'Running' : 'Stopped'} • 
                    {serviceStatus.mikrotik.activeConnections > 0 
                      ? `${serviceStatus.mikrotik.activeConnections} connections` 
                      : 'No connections'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleToggleService('mikrotik', !serviceStatus.mikrotik.enabled)}
                disabled={isToggling}
                className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                  serviceStatus.mikrotik.enabled 
                    ? 'bg-purple-600 shadow-md shadow-purple-600/30' 
                    : 'bg-slate-300'
                } disabled:opacity-50`}
              >
                <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  serviceStatus.mikrotik.enabled ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </button>
            </div>
            <div className="text-[9px] text-slate-600 font-medium bg-white/60 rounded-lg p-2">
              {serviceStatus.mikrotik.enabled 
                ? '✅ Active: MikroTik router management and billing'
                : '⏸️ Disabled: Frees CPU/memory, disables MikroTik features'}
            </div>
          </div>
        </div>
      </section>

      <NodeMCUFlasher />

      {/* Security & Service Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Settings Card */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Admin Security</h3>
          <ChangePasswordForm />
        </section>

        {/* Centralized Key Card */}
        <CentralizedKeyCard />

      </div>

      <LogTerminal />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Machine Controls */}
        <div className="admin-card">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xl">⚙️</span>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Machine Controls</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShowRestartModal(true)}
              className="admin-btn-primary flex items-center justify-center gap-3"
            >
              <span>🔄</span> RESTART SYSTEM
            </button>
            <button
              onClick={() => handleServiceAction('sync')}
              className="bg-indigo-50 text-indigo-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <span>☁️</span> CLOUD SYNC
            </button>
            <button
              onClick={() => handleServiceAction('clear-logs')}
              className="bg-slate-50 text-slate-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
            >
              <span>🧹</span> CLEAR LOGS
            </button>
            <button
              onClick={() => handleServiceAction('export-db')}
              className="bg-emerald-50 text-emerald-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
            >
              <span>💾</span> BACKUP DB
            </button>
          </div>
        </div>

        {/* Maintenance */}
        <div className="admin-card">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xl">🛡️</span>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Maintenance</h3>
          </div>
          <div className="space-y-4">
            <button
              onClick={() => handleServiceAction('kernel-check')}
              className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <span>🐧</span> CHECK KERNEL VERSION
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-red-50 text-red-600 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-red-100 flex items-center justify-center gap-2"
            >
              <span>⚠️</span> FACTORY RESET
            </button>
          </div>
        </div>
      </section>

      {/* Restart Modal */}
      {showRestartModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">🔄</div>
            <h3 className="text-sm font-black text-slate-900 uppercase">System Restart</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase leading-relaxed">
              Select restart method
            </p>
            
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button 
                onClick={() => {
                    setShowRestartModal(false);
                    handleServiceAction('restart', { type: 'hard' });
                }}
                className="bg-red-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md shadow-red-600/10 hover:bg-red-700 transition-all active:scale-95"
              >
                Hard Restart
                <span className="block text-[8px] opacity-70 mt-1 font-mono">sudo reboot</span>
              </button>
              
              <button 
                onClick={() => {
                    setShowRestartModal(false);
                    handleServiceAction('restart', { type: 'soft' });
                }}
                className="bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-md shadow-indigo-600/10 hover:bg-indigo-700 transition-all active:scale-95"
              >
                Soft Restart
                <span className="block text-[8px] opacity-70 mt-1 font-mono">pm2 restart all</span>
              </button>
            </div>

            <button 
              onClick={() => setShowRestartModal(false)}
              className="mt-4 text-slate-400 text-[10px] font-bold uppercase hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl border border-slate-200">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>
            <h3 className="text-sm font-black text-slate-900 uppercase">Confirm Wipe</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase leading-relaxed">
              Type <span className="text-red-600 font-black">FACTORY RESET</span> to proceed.
            </p>
            
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full mt-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center font-black text-sm outline-none focus:border-red-600 transition-all uppercase"
              placeholder="..."
              autoFocus
            />

            <div className="grid grid-cols-2 gap-2 mt-6">
              <button 
                onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                className="bg-slate-100 text-slate-600 py-2.5 rounded-lg font-black text-[10px] uppercase"
              >
                Abort
              </button>
              <button 
                onClick={handleReset}
                disabled={confirmText !== 'FACTORY RESET'}
                className="bg-red-600 text-white py-2.5 rounded-lg font-black text-[10px] uppercase shadow-md shadow-red-600/10 disabled:opacity-30"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {isResetting && (
        <div className="fixed inset-0 z-[300] bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-white font-black text-[10px] uppercase tracking-widest">Factory Reset in Progress...</p>
        </div>
      )}
    </div>
  );
};

const DiagItem: React.FC<{ label: string; value: string; icon: string }> = ({ label, value, icon }) => (
  <div className="p-3 flex flex-col gap-1">
    <div className="flex items-center gap-1.5">
      <span className="text-xs">{icon}</span>
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-[10px] font-black text-slate-800 tracking-tight">{value}</span>
  </div>
);

const ServiceButton: React.FC<{ label: string; icon: string; onClick?: () => void }> = ({ label, icon, onClick }) => (
  <button 
    onClick={onClick}
    className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col items-center gap-1.5 hover:bg-white hover:shadow-md transition-all active:scale-95 group"
  >
    <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
  </button>
);

const LogTerminal: React.FC = () => {
  const [logs, setLogs] = useState('Loading logs...');
  
  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('rjd_admin_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/system/logs', { headers });
      
      if (res.status === 401) {
        setLogs('Unauthorized: Please login to view logs.');
        return;
      }
      
      const data = await res.json();
      setLogs(data.logs);
    } catch (e) {
      setLogs('Failed to load logs.');
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mt-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Logs</h3>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
        </div>
      </div>
      <div className="font-mono text-[9px] text-green-400 h-48 overflow-auto whitespace-pre-wrap leading-tight opacity-90">
        {logs}
      </div>
    </div>
  );
};

const ChangePasswordForm: React.FC = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await apiClient.changePassword(oldPassword, newPassword);
      setMessage('✅ Updated');
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setMessage(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="space-y-3">
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Current</label>
        <input 
          type="password" 
          value={oldPassword}
          onChange={e => setOldPassword(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          placeholder="••••••••"
        />
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">New</label>
        <input 
          type="password" 
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          placeholder="••••••••"
        />
      </div>
      {message && <p className="text-[10px] font-bold">{message}</p>}
      <button 
        type="submit" 
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md shadow-blue-600/10 disabled:opacity-50"
      >
        {loading ? '...' : 'Update Password'}
      </button>
    </form>
  );
};

const NodeMCUFlasher: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [selectedPort, setSelectedPort] = useState('');
  const [output, setOutput] = useState('');

  const scanDevices = async () => {
    setScanning(true);
    try {
      const devs = await apiClient.getUSBDevices();
      setDevices(devs);
      if (devs.length > 0) setSelectedPort(devs[0].path);
    } catch (e) {
      console.error(e);
      alert('Failed to scan USB devices');
    } finally {
      setScanning(false);
    }
  };

  const handleFlash = async () => {
    if (!selectedPort) return;
    if (!confirm(`Flash firmware to ${selectedPort}? This will erase existing data on the NodeMCU.`)) return;
    
    setFlashing(true);
    setOutput('Starting flash process... This may take a minute.\n');
    
    try {
      const res = await apiClient.flashNodeMCU(selectedPort);
      setOutput(prev => prev + (res.output || res.message));
      alert('Flashing complete!');
    } catch (e: any) {
      setOutput(prev => prev + '\nError: ' + e.message);
      alert('Flashing failed: ' + e.message);
    } finally {
      setFlashing(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all mb-4">
      <div className="px-4 py-3 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center">
        <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">NodeMCU Flasher</h3>
        <span className="bg-indigo-100 text-indigo-600 text-[8px] font-bold px-2 py-0.5 rounded uppercase">USB / Serial</span>
      </div>
      <div className="p-4">
        <div className="flex gap-4 items-start">
           <div className="flex-1">
             <div className="flex justify-between items-center mb-2">
               <label className="text-[10px] font-bold uppercase text-slate-500">Connected Devices</label>
               <button 
                 onClick={scanDevices} 
                 disabled={scanning || flashing}
                 className="text-[9px] font-black text-blue-600 hover:underline disabled:opacity-50"
               >
                 {scanning ? 'Scanning...' : 'Refresh List'}
               </button>
             </div>
             
             {devices.length === 0 ? (
               <div className="text-xs text-slate-400 italic p-2 border border-dashed border-slate-200 rounded">
                 No USB devices found. Connect NodeMCU via USB.
               </div>
             ) : (
               <div className="space-y-1">
                 {devices.map(dev => (
                   <label key={dev.path} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                     <input 
                       type="radio" 
                       name="usb-port" 
                       value={dev.path} 
                       checked={selectedPort === dev.path}
                       onChange={() => setSelectedPort(dev.path)}
                       disabled={flashing}
                     />
                     <div>
                       <div className="text-xs font-bold text-slate-700">{dev.path}</div>
                       <div className="text-[9px] text-slate-400">{dev.manufacturer || 'Generic USB Serial'}</div>
                     </div>
                   </label>
                 ))}
               </div>
             )}
           </div>
           
           <div className="w-1/3 flex flex-col gap-2">
             <button
               onClick={handleFlash}
               disabled={!selectedPort || flashing || devices.length === 0}
               className="w-full bg-indigo-600 text-white py-3 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md shadow-indigo-600/10 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none"
             >
               {flashing ? 'Flashing...' : 'Flash Firmware'}
             </button>
             <p className="text-[8px] text-slate-400 text-center leading-tight">
               Uses binary from <br/> <code className="bg-slate-100 px-1 rounded">/opt/.../build/</code>
             </p>
           </div>
        </div>
        
        {output && (
          <div className="mt-4 p-3 bg-slate-900 rounded-lg font-mono text-[9px] text-green-400 whitespace-pre-wrap max-h-32 overflow-auto">
            {output}
          </div>
        )}
      </div>
    </section>
  );
};

const CentralizedKeyCard: React.FC = () => {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);

  useEffect(() => {
    loadKey();
    loadSyncStatus();
  }, []);

  const loadKey = async () => {
    try {
      const res = await apiClient.getCentralizedKey();
      setKey(res.key);
      setSyncEnabled(res.syncEnabled !== false);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await apiClient.getSyncStatus();
      setSyncStatus(status);
    } catch (e) {
      console.error('Failed to load sync status', e);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      await apiClient.saveCentralizedKey(key, syncEnabled);
      setMessage('✅ Connected');
      await loadSyncStatus();
    } catch (e: any) {
      setMessage('Failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSync = async () => {
      const newState = !syncEnabled;
      setSyncEnabled(newState);
      // Auto-save when toggled
      try {
          await apiClient.saveCentralizedKey(undefined, newState);
          await loadSyncStatus();
      } catch (e) {
          console.error('Failed to save sync state', e);
      }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">☁️</span>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Centralized Cloud</h3>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleSync}
                className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${syncEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                title={syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}
            >
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${syncEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
            </button>
            <div 
              className={`w-3 h-3 rounded-full transition-colors duration-500 ${
                syncStatus?.configured && syncStatus?.hasCentralizedKey && syncStatus?.syncEnabled
                ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' 
                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              }`} 
              title={syncStatus?.configured && syncStatus?.hasCentralizedKey && syncStatus?.syncEnabled ? 'Synced with Cloud' : 'Not Synced'}
            ></div>
        </div>
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Centralized Key</label>
          <input 
            type="text" 
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
            placeholder="Enter key..."
          />
        </div>
        
        {message && <p className={`text-[10px] font-bold ${message.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
        
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md shadow-indigo-600/10 disabled:opacity-50 hover:bg-indigo-700 transition-all"
        >
          {loading ? 'Connecting...' : 'Connect & Sync'}
        </button>
        
        <p className="text-[8px] text-slate-400 leading-tight border-t border-slate-100 pt-2 mt-2">
          Links this machine to the centralized cloud dashboard to record active sessions and devices.
        </p>
      </div>
    </section>
  );
};

export default SystemSettings;