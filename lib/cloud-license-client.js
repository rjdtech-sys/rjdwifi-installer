const crypto = require('crypto');
const db = require('./db');

const DEFAULT_LICENSE_API_URL = 'https://api.rjdtech.shop';
const DEFAULT_OFFLINE_GRACE_HOURS = 72;

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

class CloudLicenseClient {
  constructor(options = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl || process.env.RJD_LICENSE_API_URL || DEFAULT_LICENSE_API_URL);
    this.edgeToken = options.edgeToken || process.env.RJD_EDGE_API_TOKEN || '';
    this.offlineGraceHours = Number(options.offlineGraceHours || process.env.RJD_LICENSE_OFFLINE_GRACE_HOURS || DEFAULT_OFFLINE_GRACE_HOURS);
    this.allowLocalFallback = String(process.env.RJD_ALLOW_LOCAL_LICENSE_FALLBACK || '').toLowerCase() === 'true';
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  async request(path, payload = {}) {
    const body = JSON.stringify(payload);
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'rjd-edge-license/1.0'
    };

    if (this.edgeToken) {
      headers['x-rjd-edge-token'] = this.edgeToken;
      headers['x-rjd-edge-signature'] = crypto
        .createHmac('sha256', this.edgeToken)
        .update(body)
        .digest('hex');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body
    });

    const text = await response.text();
    const data = parseJson(text, {});
    if (!response.ok || data.success === false) {
      const message = data.error || data.message || `Cloud request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.response = data;
      throw err;
    }
    return data;
  }

  async setupCheck({ hardwareId, appVersion, boardType }) {
    return this.request('/v1/setup/check', { hardwareId, appVersion, boardType });
  }

  async accountStatus({ email, password, hardwareId }) {
    return this.request('/v1/setup/status', { email, password, hardwareId });
  }

  async startTrial({ email, password, hardwareId, deviceName }) {
    return this.request('/v1/setup/trial', { email, password, hardwareId, deviceName });
  }

  async activate({ email, password, licenseKey, hardwareId, deviceName }) {
    return this.request('/v1/setup/activate', { email, password, licenseKey, hardwareId, deviceName });
  }

  async verify({ hardwareId, licenseKey }) {
    return this.request('/v1/license/verify', { hardwareId, licenseKey });
  }

  async cacheEntitlement(hardwareId, entitlement) {
    const now = new Date().toISOString();
    const licenseKey = entitlement.licenseKey || entitlement.license_key || null;
    const expiresAt = entitlement.expiresAt || entitlement.expires_at || null;
    const trialStartedAt = entitlement.trialStartedAt || entitlement.trial_started_at || null;
    const trialExpiresAt = entitlement.trialExpiresAt || entitlement.trial_expires_at || null;
    const isActive = entitlement.isValid || entitlement.isActivated || entitlement.status === 'active' || entitlement.status === 'trial';
    const isRevoked = entitlement.isRevoked || entitlement.status === 'revoked';

    await db.run(
      `INSERT INTO license_info (
        hardware_id, license_key, is_active, is_revoked, activated_at, expires_at,
        trial_started_at, trial_expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hardware_id) DO UPDATE SET
        license_key = excluded.license_key,
        is_active = excluded.is_active,
        is_revoked = excluded.is_revoked,
        activated_at = COALESCE(excluded.activated_at, license_info.activated_at),
        expires_at = excluded.expires_at,
        trial_started_at = COALESCE(excluded.trial_started_at, license_info.trial_started_at),
        trial_expires_at = excluded.trial_expires_at`,
      [
        hardwareId,
        licenseKey,
        isActive ? 1 : 0,
        isRevoked ? 1 : 0,
        entitlement.activatedAt || entitlement.activated_at || now,
        expiresAt,
        trialStartedAt,
        trialExpiresAt,
        now
      ]
    );

    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['license_last_cloud_check', now]).catch(() => {});
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['license_cached_entitlement', JSON.stringify(entitlement)]).catch(() => {});
  }

  async getCachedEntitlement(hardwareId) {
    const row = await db.get('SELECT * FROM license_info WHERE hardware_id = ?', [hardwareId]).catch(() => null);
    if (!row) return null;

    const lastCheck = await db.get('SELECT value FROM config WHERE key = ?', ['license_last_cloud_check']).catch(() => null);
    const cached = await db.get('SELECT value FROM config WHERE key = ?', ['license_cached_entitlement']).catch(() => null);
    const cachedPayload = parseJson(cached && cached.value, {});
    const lastCheckAt = lastCheck && lastCheck.value ? new Date(lastCheck.value) : null;
    const ageMs = lastCheckAt ? Date.now() - lastCheckAt.getTime() : Number.POSITIVE_INFINITY;
    const withinGrace = ageMs <= this.offlineGraceHours * 60 * 60 * 1000;

    return {
      ...cachedPayload,
      hardwareId,
      licenseKey: row.license_key,
      isValid: Boolean(row.is_active) && !row.is_revoked && withinGrace,
      isActivated: Boolean(row.is_active) && Boolean(row.license_key),
      isRevoked: Boolean(row.is_revoked),
      expiresAt: row.expires_at || cachedPayload.expiresAt || null,
      trialExpiresAt: row.trial_expires_at || cachedPayload.trialExpiresAt || null,
      offline: true,
      withinGrace,
      lastCloudCheck: lastCheckAt ? lastCheckAt.toISOString() : null
    };
  }
}

module.exports = {
  CloudLicenseClient,
  DEFAULT_LICENSE_API_URL
};
