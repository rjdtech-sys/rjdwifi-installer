import React, { useEffect, useMemo, useState } from 'react';

interface ZeroTierNetworkInfo {
  id: string;
  name: string;
  status: string;
  type: string;
  mac: string;
  deviceName: string;
  assignedIps: string[];
}

interface ZeroTierStatus {
  installed: boolean;
  serviceRunning: boolean;
  version: string | null;
  nodeId: string | null;
  online: boolean;
  networks: ZeroTierNetworkInfo[];
  error?: string | null;
}

interface ZeroTierInstallState {
  running: boolean;
  progress: number;
  success: boolean | null;
  error: string | null;
  logs: string[];
  startedAt: number | null;
  finishedAt: number | null;
  lastUpdateAt: number | null;
}

interface SshStatus {
  installed: boolean;
  serviceRunning: boolean;
  listeningOn22: boolean;
  port: number;
  lanIp: string | null;
  error?: string | null;
}

interface TailscaleStatus {
  installed: boolean;
  serviceRunning: boolean;
  version: string | null;
  backendState: string | null;
  online: boolean;
  nodeName: string | null;
  tailnetName: string | null;
  tailscaleIps: string[];
  loginUrl?: string | null;
  error?: string | null;
}

const RemoteManager: React.FC = () => {
  const [provider, setProvider] = useState<'tailscale' | 'zerotier'>('tailscale');
  const [sshStatus, setSshStatus] = useState<SshStatus | null>(null);
  const [sshBusy, setSshBusy] = useState<boolean>(false);
  const [sshMessage, setSshMessage] = useState<string | null>(null);
  const [sshError, setSshError] = useState<string | null>(null);

  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState<string>('');
  const [tailscaleBusy, setTailscaleBusy] = useState<boolean>(false);
  const [tailscaleMessage, setTailscaleMessage] = useState<string | null>(null);
  const [tailscaleError, setTailscaleError] = useState<string | null>(null);

  const [status, setStatus] = useState<ZeroTierStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [installState, setInstallState] = useState<ZeroTierInstallState | null>(null);
  const [installRequestError, setInstallRequestError] = useState<string | null>(null);
  const [installPolling, setInstallPolling] = useState<boolean>(false);

  const [networkIdInput, setNetworkIdInput] = useState<string>('');
  const [joinBusy, setJoinBusy] = useState<boolean>(false);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaveBusyId, setLeaveBusyId] = useState<string | null>(null);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveMessage, setLeaveMessage] = useState<string | null>(null);

  const getAdminHeaders = (customHeaders: HeadersInit = {}): HeadersInit => {
    const headers: Record<string, string> = {
      ...customHeaders as Record<string, string>
    };
    const token = typeof localStorage !== 'undefined'
      ? localStorage.getItem('rjd_admin_token')
      : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  useEffect(() => {
    loadSshStatus();
    loadTailscaleStatus();
    loadStatus();
    loadInstallState();
  }, []);

  const loadSshStatus = async () => {
    try {
      const res = await fetch('/api/remote/ssh/status', {
        headers: getAdminHeaders()
      });
      if (!res.ok) return;
      setSshStatus(await res.json());
    } catch (e) {
      console.error('Failed to load SSH status', e);
    }
  };

  const enableSsh = async () => {
    setSshBusy(true);
    setSshMessage(null);
    setSshError(null);
    try {
      const res = await fetch('/api/remote/ssh/enable', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSshStatus(data.status);
      setSshMessage(data.message || 'SSH enabled on port 22.');
    } catch (e: any) {
      setSshError(e?.message || 'Failed to enable SSH.');
    } finally {
      setSshBusy(false);
    }
  };

  const loadTailscaleStatus = async () => {
    try {
      const res = await fetch('/api/tailscale/status', {
        headers: getAdminHeaders()
      });
      if (!res.ok) return;
      setTailscaleStatus(await res.json());
    } catch (e) {
      console.error('Failed to load Tailscale status', e);
    }
  };

  const installTailscale = async () => {
    setTailscaleBusy(true);
    setTailscaleMessage(null);
    setTailscaleError(null);
    try {
      const authKey = tailscaleAuthKey.trim();
      if (authKey && !/^tskey-auth-[A-Za-z0-9_-]+$/.test(authKey)) {
        throw new Error('Invalid Tailscale auth key format. Expected tskey-auth-...');
      }

      const res = await fetch('/api/tailscale/install', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ authKey })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTailscaleStatus(data.status);
      setTailscaleMessage(data.message || 'Tailscale setup command completed.');
      setTimeout(loadTailscaleStatus, 1500);
    } catch (e: any) {
      setTailscaleError(e?.message || 'Failed to setup Tailscale.');
    } finally {
      setTailscaleBusy(false);
    }
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/zerotier/status', {
        headers: getAdminHeaders()
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const message = errBody && errBody.error ? errBody.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
      const data: ZeroTierStatus = await res.json();
      setStatus(data);
    } catch (e: any) {
      console.error('Failed to load ZeroTier status', e);
      setStatusError(e?.message || 'Failed to load ZeroTier status');
    } finally {
      setStatusLoading(false);
    }
  };

  const loadInstallState = async () => {
    try {
      const res = await fetch('/api/zerotier/install-status', {
        headers: getAdminHeaders()
      });
      if (!res.ok) {
        return;
      }
      const data: ZeroTierInstallState = await res.json();
      setInstallState(data);
    } catch {
      // Ignore install state errors; installation may not have been started yet
    }
  };

  const startInstallPolling = () => {
    if (installPolling) return;
    setInstallPolling(true);

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/zerotier/install-status', {
          headers: getAdminHeaders()
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data: ZeroTierInstallState = await res.json();
        setInstallState(data);

        if (!data.running) {
          clearInterval(interval);
          setInstallPolling(false);

          // Refresh main status shortly after installation finishes
          setTimeout(() => {
            loadStatus();
          }, 1500);
        }
      } catch (e) {
        console.error('Failed to poll install status', e);
        clearInterval(interval);
        setInstallPolling(false);
      }
    }, 2000);
  };

  const handleInstall = async () => {
    setInstallRequestError(null);
    setJoinMessage(null);
    setJoinError(null);

    try {
      const res = await fetch('/api/zerotier/install', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const message = data.error || `HTTP ${res.status}`;
        setInstallRequestError(message);
        if (data.status) {
          setInstallState(data.status);
        }
        return;
      }

      if (data.status) {
        setInstallState(data.status);
      }
      startInstallPolling();
    } catch (e: any) {
      console.error('Failed to start ZeroTier installation', e);
      setInstallRequestError(e?.message || 'Failed to start ZeroTier installation');
    }
  };

  const handleJoinNetwork = async () => {
    setJoinBusy(true);
    setJoinMessage(null);
    setJoinError(null);

    const trimmed = networkIdInput.trim();
    if (!trimmed) {
      setJoinBusy(false);
      setJoinError('Please enter a Network ID.');
      return;
    }

    if (!/^[0-9a-fA-F]{16}$/.test(trimmed)) {
      setJoinBusy(false);
      setJoinError('Network ID must be a 16-character hexadecimal string.');
      return;
    }

    try {
      const res = await fetch('/api/zerotier/join', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ networkId: trimmed })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const message = data.error || `HTTP ${res.status}`;
        setJoinError(message);
        if (data.details) {
          console.error('ZeroTier join error details:', data.details);
        }
      } else {
        setJoinMessage(data.message || 'Join command sent to ZeroTier.');
        // Refresh status after a short delay so the new network appears
        setTimeout(() => {
          loadStatus();
        }, 2000);
      }
    } catch (e: any) {
      console.error('Failed to join ZeroTier network', e);
      setJoinError(e?.message || 'Failed to join ZeroTier network.');
    } finally {
      setJoinBusy(false);
    }
  };

  const handleLeaveNetwork = async (networkId: string) => {
    if (!networkId) {
      return;
    }
    setLeaveBusyId(networkId);
    setLeaveError(null);
    setLeaveMessage(null);
    try {
      const res = await fetch('/api/zerotier/leave', {
        method: 'POST',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ networkId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        const message = data.error || `HTTP ${res.status}`;
        setLeaveError(message);
      } else {
        setLeaveMessage(data.message || 'Leave command sent to ZeroTier.');
        setTimeout(() => {
          loadStatus();
        }, 1500);
      }
    } catch (e: any) {
      console.error('Failed to leave ZeroTier network', e);
      setLeaveError(e?.message || 'Failed to leave ZeroTier network.');
    } finally {
      setLeaveBusyId(null);
    }
  };

  const installProgress = useMemo(() => {
    if (!installState) return 0;
    if (typeof installState.progress !== 'number' || isNaN(installState.progress)) return 0;
    return Math.max(0, Math.min(100, Math.round(installState.progress)));
  }, [installState]);

  const isInstallStuck = useMemo(() => {
    if (!installState || !installState.running) return false;
    if (!installState.lastUpdateAt) return false;
    const now = Date.now();
    const diff = now - installState.lastUpdateAt;
    // Consider installation "stuck" if no updates for more than 45 seconds
    return diff > 45_000;
  }, [installState]);

  const effectiveStatus = status;

  if (statusLoading && !effectiveStatus) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading Remote Access status...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Remote Access</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
            Enable SSH on port 22, then connect through Tailscale or ZeroTier
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${effectiveStatus?.online ? 'bg-green-500' : 'bg-slate-400'}`} />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              {effectiveStatus?.installed
                ? effectiveStatus.online
                  ? 'ZeroTier Online'
                  : 'ZeroTier Installed'
                : 'ZeroTier Not Installed'}
            </span>
          </div>
          {effectiveStatus?.version && (
            <span className="text-[9px] font-mono text-slate-400">
              v{effectiveStatus.version}
            </span>
          )}
        </div>
      </div>

      {statusError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-widest px-4 py-3 rounded-xl">
          Failed to load ZeroTier status: {statusError}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
              SSH Port 22
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Required for WinSCP/SFTP and normal SSH sessions
            </p>
          </div>
          <button
            onClick={loadSshStatus}
            className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
          >
            Refresh SSH
          </button>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold uppercase tracking-widest">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-slate-400 mb-1">Installed</div>
              <div className={`text-xs ${sshStatus?.installed ? 'text-green-600' : 'text-red-500'}`}>
                {sshStatus?.installed ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-slate-400 mb-1">Service</div>
              <div className={`text-xs ${sshStatus?.serviceRunning ? 'text-green-600' : 'text-amber-600'}`}>
                {sshStatus?.serviceRunning ? 'Running' : 'Stopped'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-slate-400 mb-1">Port 22</div>
              <div className={`text-xs ${sshStatus?.listeningOn22 ? 'text-green-600' : 'text-red-500'}`}>
                {sshStatus?.listeningOn22 ? 'Listening' : 'Closed'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-slate-400 mb-1">LAN IP</div>
              <div className="text-[10px] font-mono text-slate-800 break-all">
                {sshStatus?.lanIp || '-'}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={enableSsh}
              disabled={sshBusy}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all"
            >
              {sshBusy ? 'Enabling SSH...' : 'Enable SSH 22'}
            </button>
            {sshStatus?.lanIp && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] text-blue-700 font-bold uppercase tracking-widest">
                WinSCP: SFTP / {sshStatus.lanIp} / Port 22
              </div>
            )}
            {sshMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-[10px] text-emerald-700 font-bold uppercase tracking-widest">
                {sshMessage}
              </div>
            )}
            {sshError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-[10px] text-red-700 font-bold uppercase tracking-widest">
                {sshError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setProvider('tailscale')}
          className={`flex-1 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
            provider === 'tailscale'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Option 1: Tailscale
        </button>
        <button
          onClick={() => setProvider('zerotier')}
          className={`flex-1 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
            provider === 'zerotier'
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          Option 2: ZeroTier
        </button>
      </div>

      {provider === 'tailscale' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  Tailscale Status
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                  Private VPN access for SSH and WinSCP without router port-forwarding
                </p>
              </div>
              <button
                onClick={loadTailscaleStatus}
                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              >
                Refresh
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold uppercase tracking-widest">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Installed</div>
                  <div className={`text-xs ${tailscaleStatus?.installed ? 'text-green-600' : 'text-red-500'}`}>
                    {tailscaleStatus?.installed ? 'Yes' : 'No'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Service</div>
                  <div className={`text-xs ${tailscaleStatus?.serviceRunning ? 'text-green-600' : 'text-amber-600'}`}>
                    {tailscaleStatus?.serviceRunning ? 'Running' : 'Stopped'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">State</div>
                  <div className={`text-xs ${tailscaleStatus?.online ? 'text-green-600' : 'text-slate-500'}`}>
                    {tailscaleStatus?.backendState || 'Unknown'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Version</div>
                  <div className="text-[10px] font-mono text-slate-800 break-all">
                    {tailscaleStatus?.version || '-'}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className="mb-1">Tailscale IPs</div>
                <div className="font-mono text-slate-800 normal-case">
                  {tailscaleStatus?.tailscaleIps?.length ? tailscaleStatus.tailscaleIps.join(', ') : '-'}
                </div>
                {tailscaleStatus?.tailscaleIps?.[0] && (
                  <div className="mt-2 text-blue-700">
                    WinSCP: SFTP / {tailscaleStatus.tailscaleIps[0]} / Port 22
                  </div>
                )}
              </div>
              {tailscaleStatus?.loginUrl && (
                <a
                  href={tailscaleStatus.loginUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-blue-50 border border-blue-200 rounded-xl p-3 text-[10px] text-blue-700 font-black uppercase tracking-widest hover:bg-blue-100"
                >
                  Open Tailscale Login URL
                </a>
              )}
              {tailscaleStatus?.error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] text-amber-800 font-bold uppercase tracking-widest">
                  {tailscaleStatus.error}
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Setup Tailscale
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Paste an auth key for unattended setup, or leave blank to receive login URL
              </p>
            </div>
            <div className="p-4 space-y-3">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Auth Key (optional)
              </label>
              <input
                type="password"
                value={tailscaleAuthKey}
                onChange={(e) => setTailscaleAuthKey(e.target.value)}
                placeholder="tskey-auth-..."
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={installTailscale}
                disabled={tailscaleBusy}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all"
              >
                {tailscaleBusy ? 'Setting Up...' : tailscaleStatus?.installed ? 'Run Tailscale Up' : 'Install Tailscale'}
              </button>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-slate-50 border border-dashed border-slate-200 rounded-xl p-2">
                Best for remote work: install Tailscale on your Windows PC too, then use the Tailscale IP in WinSCP.
              </div>
              {tailscaleMessage && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-[10px] text-emerald-700 font-bold uppercase tracking-widest">
                  {tailscaleMessage}
                </div>
              )}
              {tailscaleError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-[10px] text-red-700 font-bold uppercase tracking-widest">
                  {tailscaleError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {provider === 'zerotier' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ZeroTier Status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  ZeroTier Status
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                  Installation, service, and identity information
                </p>
              </div>
              <button
                onClick={loadStatus}
                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              >
                Refresh
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-bold uppercase tracking-widest">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Installed</div>
                  <div className={`text-xs ${effectiveStatus?.installed ? 'text-green-600' : 'text-red-500'}`}>
                    {effectiveStatus?.installed ? 'Yes' : 'No'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Service</div>
                  <div className={`text-xs ${effectiveStatus?.serviceRunning ? 'text-green-600' : 'text-amber-600'}`}>
                    {effectiveStatus?.serviceRunning ? 'Running' : 'Not Running'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Node ID</div>
                  <div className="text-[10px] font-mono text-slate-800 break-all">
                    {effectiveStatus?.nodeId || '-'}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-400 mb-1">Online</div>
                  <div className={`text-xs ${effectiveStatus?.online ? 'text-green-600' : 'text-slate-500'}`}>
                    {effectiveStatus?.online ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>

              {effectiveStatus?.error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] text-amber-800 font-bold uppercase tracking-widest">
                  {effectiveStatus.error}
                </div>
              )}

              <div className="mt-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  Joined Networks
                </h3>
                {effectiveStatus?.networks && effectiveStatus.networks.length > 0 ? (
                  <div className="space-y-2">
                    {effectiveStatus.networks.map((net) => {
                      const id = net.id || '';
                      const busy = leaveBusyId === id;
                      return (
                        <div
                          key={id || net.name}
                          className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                                {net.name || 'Unnamed Network'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {id || 'Unknown ID'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                  net.status === 'OK'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {net.status || 'Unknown'}
                              </span>
                              {id && (
                                <button
                                  onClick={() => handleLeaveNetwork(id)}
                                  disabled={busy}
                                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border active:scale-95 transition-all ${
                                    busy
                                      ? 'bg-slate-200 border-slate-200 text-slate-500 cursor-not-allowed'
                                      : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                  }`}
                                >
                                  {busy ? 'Leaving...' : 'Leave'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            <div>
                              <span>Type: </span>
                              <span className="text-slate-700">{net.type || '-'}</span>
                            </div>
                            <div>
                              <span>Interface: </span>
                              <span className="text-slate-700">{net.deviceName || '-'}</span>
                            </div>
                            <div className="col-span-2">
                              <span>Assigned IPs: </span>
                              <span className="text-slate-700 font-mono">
                                {net.assignedIps && net.assignedIps.length > 0
                                  ? net.assignedIps.join(', ')
                                  : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {(leaveError || leaveMessage) && (
                      <div className="mt-2 space-y-1">
                        {leaveError && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-[10px] text-red-700 font-bold uppercase tracking-widest">
                            {leaveError}
                          </div>
                        )}
                        {leaveMessage && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-[10px] text-emerald-700 font-bold uppercase tracking-widest">
                            {leaveMessage}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3">
                    No networks joined yet. Enter a Network ID on the right to join.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Installation & Network Join */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                ZeroTier Installation
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                One-click installer with live progress and error logs
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Installer Status
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {installState?.running
                      ? 'Installing...'
                      : installState?.success
                        ? 'Completed'
                        : installState?.error
                          ? 'Failed'
                          : 'Idle'}
                  </span>
                </div>
                <button
                  onClick={handleInstall}
                  disabled={installState?.running === true || effectiveStatus?.installed}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all ${
                    installState?.running
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : effectiveStatus?.installed
                        ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {installState?.running
                    ? 'Installing...'
                    : effectiveStatus?.installed
                      ? 'Already Installed'
                      : 'Install ZeroTier'}
                </button>
              </div>

              <div className="mt-2 space-y-1">
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 transition-all"
                    style={{ width: `${installProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                  <span>{installProgress}%</span>
                  {isInstallStuck && (
                    <span className="text-amber-600">
                      No progress updates detected. Installation may be stuck.
                    </span>
                  )}
                </div>
              </div>

              {installRequestError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-[10px] text-red-700 font-bold uppercase tracking-widest">
                  {installRequestError}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Join ZeroTier Network
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                Add a Network ID to link this machine to your ZeroTier virtual network
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Network ID (16-character hex)
                </label>
                <input
                  type="text"
                  value={networkIdInput}
                  onChange={(e) => setNetworkIdInput(e.target.value)}
                  placeholder="e.g. 8056c2e21c000001"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleJoinNetwork}
                disabled={!effectiveStatus?.installed || joinBusy}
                className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all ${
                  !effectiveStatus?.installed
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {joinBusy ? 'Sending Join Command...' : 'Join Network'}
              </button>

              {joinError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-[10px] text-red-700 font-bold uppercase tracking-widest">
                  {joinError}
                </div>
              )}
              {joinMessage && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2 text-[10px] text-emerald-700 font-bold uppercase tracking-widest">
                  {joinMessage}
                </div>
              )}

              {!effectiveStatus?.installed && (
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-slate-50 border border-dashed border-slate-200 rounded-xl p-2">
                  Install ZeroTier first before joining a network.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
            <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <h2 className="text-[10px] font-black text-slate-200 uppercase tracking-widest">
                Installation Logs
              </h2>
              <span className="text-[9px] font-mono text-slate-400">
                {installState?.logs?.length || 0} lines
              </span>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto text-[10px] font-mono text-slate-200 bg-slate-950/80">
              {installState && installState.logs && installState.logs.length > 0 ? (
                installState.logs.map((line, idx) => (
                  <div key={`${idx}-${line.slice(0, 16)}`} className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">
                  No installation logs yet. Start an installation to see live output here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
};

export default RemoteManager;
