import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  UserRound
} from 'lucide-react';

type SetupCheck = {
  success: boolean;
  setup_required: boolean;
  needs_license: boolean;
  needs_password_change: boolean;
  cloud_available: boolean;
  license_api_url: string;
  hardware_id: string;
  board_type: string;
  app_version: string;
  entitlement?: {
    status?: string;
    licenseKey?: string | null;
    licenseType?: string | null;
    expiresAt?: string | null;
    isValid?: boolean;
    isActivated?: boolean;
  };
  error?: string;
};

type Step = 'account' | 'license' | 'password' | 'complete';
type Mode = 'trial' | 'license';

const SetupWizard: React.FC = () => {
  const [check, setCheck] = useState<SetupCheck | null>(null);
  const [step, setStep] = useState<Step>('account');
  const [mode, setMode] = useState<Mode>('trial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCheck = useCallback(async (): Promise<SetupCheck | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<SetupCheck>('/setup/check');
      setCheck(data);
      if (!data.setup_required) {
        setStep('complete');
      } else if (data.needs_license) {
        setStep('account');
      } else if (data.needs_password_change) {
        setStep('password');
      } else {
        setStep('complete');
      }
      return data;
    } catch (err: any) {
      setError(err.message || 'Setup check failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'RJD Setup';
    loadCheck();
  }, [loadCheck]);

  const statusLabel = useMemo(() => {
    const entitlement = check?.entitlement || {};
    if (entitlement.status) return entitlement.status;
    if (entitlement.isValid || entitlement.isActivated) return 'active';
    return check?.needs_license ? 'pending' : 'ready';
  }, [check]);

  const continueAfterLicense = useCallback(async () => {
    const latest = await loadCheck();
    setStep(latest?.needs_password_change ? 'password' : 'complete');
  }, [loadCheck]);

  const handleAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await request('/setup/status', { email: email.trim(), password });
      setNotice('Account verified.');
      setStep(check?.needs_license ? 'license' : check?.needs_password_change ? 'password' : 'complete');
    } catch (err: any) {
      setError(err.message || 'Account verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLicense = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'license') {
        await request('/setup/activate', {
          email: email.trim(),
          password,
          license_key: licenseKey.trim(),
          device_name: deviceName.trim() || undefined
        });
        setNotice('License activated.');
      } else {
        await request('/setup/trial', {
          email: email.trim(),
          password,
          device_name: deviceName.trim() || undefined
        });
        setNotice('Trial started.');
      }
      await continueAfterLicense();
    } catch (err: any) {
      setError(err.message || 'Activation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      await request('/setup/password', { new_password: newPassword });
      setNotice('Administrator password updated.');
      await loadCheck();
      setStep('complete');
    } catch (err: any) {
      setError(err.message || 'Password update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Loading" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-950 px-5 py-6 text-white lg:border-b-0 lg:border-r lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest">RJD Setup</h1>
              <p className="text-xs font-bold text-slate-400">v{check?.app_version || '0.0.0'}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <InfoRow icon={<Server />} label="Cloud" value={check?.cloud_available ? 'Connected' : 'Offline'} tone={check?.cloud_available ? 'green' : 'amber'} />
            <InfoRow icon={<KeyRound />} label="License" value={statusLabel} tone={statusLabel === 'active' || statusLabel === 'trial' ? 'green' : 'amber'} />
            <InfoRow icon={<LockKeyhole />} label="Password" value={check?.needs_password_change ? 'Required' : 'Ready'} tone={check?.needs_password_change ? 'amber' : 'green'} />
          </div>

          <div className="mt-6 space-y-3 rounded border border-white/10 bg-white/5 p-4">
            <Meta label="Hardware ID" value={check?.hardware_id || 'unknown'} mono />
            <Meta label="Board" value={check?.board_type || 'unknown'} />
            <Meta label="API" value={check?.license_api_url || 'not set'} />
          </div>
        </aside>

        <main className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-3xl">
            <StepRail current={step} check={check} />

            {error && (
              <div className="mb-4 flex gap-3 rounded border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="mb-4 flex gap-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {step === 'account' && (
              <Panel title="Customer Account" icon={<UserRound className="h-5 w-5" />}>
                <form onSubmit={handleAccount} className="space-y-4">
                  <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required />
                  <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" required />
                  <Action disabled={submitting || !email.trim() || !password} loading={submitting} label="Verify Account" />
                </form>
              </Panel>
            )}

            {step === 'license' && (
              <Panel title="Activation" icon={<KeyRound className="h-5 w-5" />}>
                <form onSubmit={handleLicense} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded bg-slate-100 p-1">
                    <ModeButton active={mode === 'trial'} onClick={() => setMode('trial')} label="Trial" />
                    <ModeButton active={mode === 'license'} onClick={() => setMode('license')} label="License" />
                  </div>
                  <Field label="Device Name" value={deviceName} onChange={setDeviceName} placeholder="RJD Orange Pi One" />
                  {mode === 'license' && (
                    <Field label="License Key" value={licenseKey} onChange={setLicenseKey} placeholder="RJD-XXXXXX-XXXXXX" required />
                  )}
                  <Action
                    disabled={submitting || !email.trim() || !password || (mode === 'license' && !licenseKey.trim())}
                    loading={submitting}
                    label={mode === 'license' ? 'Activate License' : 'Start Trial'}
                  />
                </form>
              </Panel>
            )}

            {step === 'password' && (
              <Panel title="Administrator Password" icon={<LockKeyhole className="h-5 w-5" />}>
                <form onSubmit={handlePassword} className="space-y-4">
                  <Field label="New Password" value={newPassword} onChange={setNewPassword} type="password" autoComplete="new-password" required />
                  <Field label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" required />
                  <Action disabled={submitting || newPassword.length < 6 || !confirmPassword} loading={submitting} label="Save Password" />
                </form>
              </Panel>
            )}

            {step === 'complete' && (
              <Panel title="Ready" icon={<CheckCircle2 className="h-5 w-5" />}>
                <div className="space-y-4">
                  <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                    Setup gate is complete for this device.
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => window.location.assign('/admin')}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded bg-slate-950 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800"
                    >
                      Open Admin
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={loadCheck}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-5 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        </main>
      </div>
    </Shell>
  );
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-50 font-sans text-slate-900">{children}</div>
);

const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="rounded border border-slate-200 bg-white shadow-sm">
    <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-50 text-blue-700">{icon}</div>
      <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">{title}</h2>
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}> = ({ label, value, onChange, type = 'text', placeholder, autoComplete, required }) => (
  <label className="block">
    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
    <input
      className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
    />
  </label>
);

const Action: React.FC<{ disabled: boolean; loading: boolean; label: string }> = ({ disabled, loading, label }) => (
  <button
    type="submit"
    disabled={disabled}
    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {label}
  </button>
);

const ModeButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-10 rounded text-xs font-black uppercase tracking-widest transition ${
      active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
    }`}
  >
    {label}
  </button>
);

const StepRail: React.FC<{ current: Step; check: SetupCheck | null }> = ({ current, check }) => {
  const steps: { key: Step; label: string; disabled?: boolean }[] = [
    { key: 'account', label: 'Account', disabled: !check?.needs_license },
    { key: 'license', label: 'License', disabled: !check?.needs_license },
    { key: 'password', label: 'Password', disabled: !check?.needs_password_change },
    { key: 'complete', label: 'Ready' }
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((item) => {
        const active = current === item.key;
        const done = item.disabled || current === 'complete';
        return (
          <div
            key={item.key}
            className={`rounded border px-3 py-2 ${
              active
                ? 'border-blue-300 bg-blue-50 text-blue-800'
                : done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <div className="flex items-center gap-2">
              {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string; tone: 'green' | 'amber' }> = ({ icon, label, value, tone }) => (
  <div className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-3">
    <div className={tone === 'green' ? 'text-emerald-300' : 'text-amber-300'}>{icon}</div>
    <div className="min-w-0">
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className="truncate text-xs font-black uppercase tracking-wider text-white">{value}</div>
    </div>
  </div>
);

const Meta: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div>
    <div className={`mt-1 break-all text-xs font-bold text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);

async function request<T = any>(url: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || `Request failed with ${response.status}`);
  }
  return data;
}

export default SetupWizard;
