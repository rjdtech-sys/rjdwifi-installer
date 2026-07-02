import React, { useState, useEffect } from 'react';
import { NodeMCUDevice } from '../../types';
import { initializeNodeMCULicenseManager, getNodeMCULicenseManager } from '../../lib/nodemcu-license';
import { toast } from 'sonner';

interface NodeMCULicenseManagerProps {
  devices: NodeMCUDevice[];
  vendorId?: string;
  initialLicenses?: any[];
}

const NodeMCULicenseManager: React.FC<NodeMCULicenseManagerProps> = ({ devices, vendorId, initialLicenses }) => {
  const [licenses, setLicenses] = useState<any[]>(initialLicenses || []);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<NodeMCUDevice | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  // License generation state removed – handled by Supabase

  const licenseManager = getNodeMCULicenseManager();

  useEffect(() => {
    if (!initialLicenses) {
      loadLicenses();
    }
  }, [initialLicenses]);

  const loadLicenses = async () => {
    setLoading(true);
    try {
      // Always load licenses from our own API first (which now includes local trial info)
      const response = await fetch('/api/nodemcu/license/vendor', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('rjd_admin_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLicenses(data.licenses || []);
        }
      } else if (licenseManager.isConfigured()) {
        // Fallback to direct Supabase if API fails but Supabase is configured
        const vendorLicenses = await licenseManager.getVendorLicenses();
        setLicenses(vendorLicenses);
      }
    } catch (error) {
      console.error('Failed to load licenses:', error);
      toast.error('Failed to load NodeMCU licenses');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async (device: NodeMCUDevice) => {
    try {
      const result = await licenseManager.startTrial(device.macAddress);
      if (result.success) {
        toast.success('Trial started successfully!');
        loadLicenses();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Trial start error:', error);
      toast.error('Failed to start trial');
    }
  };

  const handleActivateLicense = async () => {
    // Log intent
    console.log('NodeMCULicenseManager: Activate button clicked');
    const toastId = toast.loading('Processing activation...');

    fetch('/api/debug/log', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ message: `Button Clicked: Activating License`, level: 'INFO', component: 'NodeMCULicenseManager.tsx' })
    }).catch(() => {});

    if (!selectedDevice || !licenseKey.trim()) {
      toast.dismiss(toastId);
      toast.error('Please select a device and enter a license key');
      return;
    }

    try {
      const result = await licenseManager.activateLicense(licenseKey.trim(), selectedDevice.macAddress);
      toast.dismiss(toastId);
      
      if (result.success) {
        toast.success('License activated successfully!');
        setLicenseKey('');
        setSelectedDevice(null);
        loadLicenses();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('License activation error:', error);
      toast.error('Failed to activate license');
    }
  };

  const handleRevokeLicense = async (licenseKey: string) => {
    if (!confirm('Are you sure you want to revoke this license?')) {
      return;
    }

    try {
      const result = await licenseManager.revokeLicense(licenseKey);
      if (result.success) {
        toast.success('License revoked successfully');
        loadLicenses();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('License revocation error:', error);
      toast.error('Failed to revoke license');
    }
  };

  const getLicenseStatus = (license: any) => {
    if (license.isLocalTrial) {
      const expiresAt = new Date(license.expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (expiresAt < now) {
        return { text: 'Frozen', color: 'bg-red-100 text-red-700' };
      }
      return { text: `${daysRemaining}d Trial left`, color: 'bg-blue-100 text-blue-700' };
    }

    if (!license.is_active) {
      return { text: 'Unassigned', color: 'bg-slate-100 text-slate-600' };
    }
    
    if (license.expires_at) {
      const expiresAt = new Date(license.expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (expiresAt < now) {
        if (license.license_type === 'trial') return { text: 'Frozen', color: 'bg-red-100 text-red-700' };
        return { text: 'Expired', color: 'bg-red-100 text-red-700' };
      } else if (daysRemaining <= 7) {
        return { text: `${daysRemaining}d left`, color: 'bg-amber-100 text-amber-700' };
      } else {
        return { text: `${daysRemaining}d left`, color: 'bg-emerald-100 text-emerald-700' };
      }
    }
    
    return { text: 'Active', color: 'bg-emerald-100 text-emerald-700' };
  };

  const getDeviceLicenseStatus = (device: NodeMCUDevice) => {
    const deviceLicense = licenses.find(lic => (lic.device_id === device.id || lic.mac_address === device.macAddress) && (lic.is_active || lic.isLocalTrial));
    
    if (!deviceLicense) {
      return { 
        hasLicense: false, 
        canStartTrial: true,
        status: { text: 'No License', color: 'bg-red-100 text-red-700' }
      };
    }

    const status = getLicenseStatus(deviceLicense);
    const isExpired = status.text.includes('Expired');
    
    return {
      hasLicense: true,
      license: deviceLicense,
      isExpired,
      canStartTrial: false,
      status
    };
  };

  return (
    <div className="space-y-4">
      {/* Local Trial Info Banner */}
      {!licenseManager.isConfigured() && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Local Trial System Active</h3>
              <p className="text-[8px] text-blue-600 font-bold uppercase tracking-tighter">
                Devices will automatically start a 7-day local trial. You can still input a cloud license key below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* License Management Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">NodeMCU License Management</h3>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Manage licenses for your NodeMCU/Subvendo devices</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadLicenses}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* License Activation Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-3">Activate License</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Device</label>
            <select
              value={selectedDevice?.id || ''}
              onChange={(e) => {
                const device = devices.find(d => d.id === e.target.value);
                setSelectedDevice(device || null);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a device...</option>
              {devices.filter(d => d.status === 'accepted').map(device => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.macAddress})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">License Key</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="NODEMCU-XXXX-XXXX"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleActivateLicense}
                className="px-4 py-2 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Devices with License Status */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Device License Status</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/30">
              <tr>
                <th className="px-4 py-2 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Device</th>
                <th className="px-4 py-2 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">MAC Address</th>
                <th className="px-4 py-2 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">License Status</th>
                <th className="px-4 py-2 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">License Key</th>
                <th className="px-4 py-2 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {devices.filter(d => d.status === 'accepted').map(device => {
                const licenseInfo = getDeviceLicenseStatus(device);
                return (
                  <tr key={device.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[10px] font-black text-slate-900 uppercase">{device.name}</div>
                      <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">
                        Revenue: ₱{device.totalRevenue.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[9px] font-mono text-slate-600">{device.macAddress}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${licenseInfo.status.color}`}>
                        {licenseInfo.status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {licenseInfo.hasLicense ? (
                        <div className="text-[9px] font-mono text-slate-600">
                          {licenseInfo.license.license_key}
                          {licenseInfo.license.license_type === 'trial' && (
                            <span className="ml-2 px-1 py-0.5 bg-blue-100 text-blue-700 text-[7px] font-black rounded">TRIAL</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-400">No license assigned</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {licenseInfo.hasLicense ? (
                          <>
                            {!licenseInfo.isExpired && (
                              <button
                                onClick={() => licenseInfo.license && handleRevokeLicense(licenseInfo.license.license_key)}
                                className="px-2 py-1 bg-rose-100 text-rose-700 text-[8px] font-black uppercase tracking-wider rounded hover:bg-rose-200 transition-all"
                              >
                                Revoke
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handleStartTrial(device)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-[8px] font-black uppercase tracking-wider rounded hover:bg-blue-200 transition-all"
                          >
                            Start Trial
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default NodeMCULicenseManager;
