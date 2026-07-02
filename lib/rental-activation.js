const { createClient } = require('@supabase/supabase-js');
const db = require('./db');

// Lazy-load edgeSync to avoid circular dependency at module init time
function getEdgeSync() {
  try { return require('./edge-sync'); } catch (e) { return null; }
}

/**
 * RentalActivationManager - Handles Phone Rental device activation via Supabase
 * 
 * Flow:
 * 1. Phone app registers → auto 7-day trial → appears as "pending" in admin
 * 2. Admin clicks "Accept" → device becomes "trial" status
 * 3. Admin enters activation key → device becomes "active" (licensed)
 * 4. When trial/license expires → device auto "expired" → deactivated on next heartbeat
 * 5. Admin can "Reject" or "Deactivate" anytime
 */
class RentalActivationManager {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    this.supabase = null;

    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
      console.log('[RentalActivation] Supabase client initialized');
    } else {
      console.warn('[RentalActivation] No Supabase credentials - running in local-only mode');
    }
  }

  /**
   * Register a device in Supabase (called when phone app connects for the first time)
   * Auto-starts 7-day trial
   */
  async registerDevice(macAddress, deviceInfo = {}) {
    if (!this.supabase) {
      console.warn('[RentalActivation] No Supabase - skipping cloud registration');
      return { success: true, activation_status: 'trial', message: 'Local mode' };
    }

    try {
      // Get the vendor_id for this machine
      const vendorId = await this.getMachineVendorId();

      const { data, error } = await this.supabase
        .rpc('register_rental_device', {
          p_mac_address: macAddress.toUpperCase(),
          p_android_id: deviceInfo.android_id || null,
          p_device_name: deviceInfo.device_name || null,
          p_model: deviceInfo.model || null,
          p_ip_address: deviceInfo.ip_address || null,
          p_vendor_id: vendorId,
          p_machine_id: await this.getMachineId()
        });

      if (error) {
        console.error('[RentalActivation] Register error:', error);
        return { success: false, error: error.message };
      }

      // Sync back to local DB
      if (data && data.success) {
        await this.syncToLocal(macAddress, data);
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Register exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check device activation status from Supabase
   */
  async checkStatus(macAddress) {
    if (!this.supabase) {
      // Local fallback - check local DB
      return await this.checkLocalStatus(macAddress);
    }

    try {
      const { data, error } = await this.supabase
        .rpc('check_rental_device_status', {
          p_mac_address: macAddress.toUpperCase()
        });

      if (error) {
        console.error('[RentalActivation] Check status error:', error);
        return await this.checkLocalStatus(macAddress);
      }

      // Sync status back to local
      if (data && data.success) {
        await this.syncActivationStatus(macAddress, data);
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Check status exception:', err);
      return await this.checkLocalStatus(macAddress);
    }
  }

  /**
   * Accept a pending device (vendor action)
   */
  async acceptDevice(deviceId) {
    if (!this.supabase) {
      // Local only
      await db.run(
        `UPDATE rental_devices SET accepted_by_vendor = 1, activation_status = 'trial', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [deviceId]
      );
      return { success: true, message: 'Device accepted (local)' };
    }

    try {
      // Get cloud device ID
      const device = await db.get('SELECT cloud_device_id, mac_address FROM rental_devices WHERE id = ?', [deviceId]);
      if (!device || !device.cloud_device_id) {
        // Fallback to local
        await db.run(
          `UPDATE rental_devices SET accepted_by_vendor = 1, activation_status = 'trial', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deviceId]
        );
        return { success: true, message: 'Device accepted (local - no cloud ID)' };
      }

      const vendorId = await this.getMachineVendorId();

      const { data, error } = await this.supabase
        .rpc('accept_rental_device', {
          p_device_id: device.cloud_device_id,
          p_vendor_id: vendorId
        });

      if (error) {
        console.error('[RentalActivation] Accept error:', error);
        return { success: false, error: error.message };
      }

      // Update local
      if (data && data.success) {
        await db.run(
          `UPDATE rental_devices SET accepted_by_vendor = 1, activation_status = 'trial', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deviceId]
        );
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Accept exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reject a pending device (vendor action)
   */
  async rejectDevice(deviceId) {
    if (!this.supabase) {
      await db.run(
        `UPDATE rental_devices SET activation_status = 'rejected', deactivated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [deviceId]
      );
      return { success: true, message: 'Device rejected (local)' };
    }

    try {
      const device = await db.get('SELECT cloud_device_id FROM rental_devices WHERE id = ?', [deviceId]);
      if (!device || !device.cloud_device_id) {
        await db.run(
          `UPDATE rental_devices SET activation_status = 'rejected', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deviceId]
        );
        return { success: true, message: 'Device rejected (local)' };
      }

      const vendorId = await this.getMachineVendorId();

      const { data, error } = await this.supabase
        .rpc('reject_rental_device', {
          p_device_id: device.cloud_device_id,
          p_vendor_id: vendorId
        });

      if (error) {
        console.error('[RentalActivation] Reject error:', error);
        return { success: false, error: error.message };
      }

      // Update local
      if (data && data.success) {
        await db.run(
          `UPDATE rental_devices SET activation_status = 'rejected', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deviceId]
        );
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Reject exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Activate a device with an activation key
   */
  async activateDevice(deviceId, activationKey) {
    if (!this.supabase) {
      // Local only - simple key check
      const keyMatch = activationKey.match(/^RENT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      if (keyMatch) {
        await db.run(
          `UPDATE rental_devices SET activation_status = 'active', activation_key = ?, accepted_by_vendor = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [activationKey, deviceId]
        );
        return { success: true, message: 'Device activated (local)' };
      }
      return { success: false, error: 'Invalid activation key format' };
    }

    try {
      const device = await db.get('SELECT cloud_device_id FROM rental_devices WHERE id = ?', [deviceId]);
      if (!device || !device.cloud_device_id) {
        return { success: false, error: 'Device not synced to cloud' };
      }

      const vendorId = await this.getMachineVendorId();

      const { data, error } = await this.supabase
        .rpc('activate_rental_device', {
          p_activation_key: activationKey.toUpperCase().trim(),
          p_device_id: device.cloud_device_id,
          p_vendor_id: vendorId
        });

      if (error) {
        console.error('[RentalActivation] Activate error:', error);
        return { success: false, error: error.message };
      }

      // Update local DB
      if (data && data.success) {
        await db.run(
          `UPDATE rental_devices SET activation_status = 'active', activation_key = ?, accepted_by_vendor = 1, license_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [activationKey, data.expires_at || null, deviceId]
        );
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Activate exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId) {
    if (!this.supabase) {
      await db.run(
        `UPDATE rental_devices SET activation_status = 'deactivated', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [deviceId]
      );
      return { success: true, message: 'Device deactivated (local)' };
    }

    try {
      const device = await db.get('SELECT cloud_device_id FROM rental_devices WHERE id = ?', [deviceId]);
      if (!device || !device.cloud_device_id) {
        await db.run(
          `UPDATE rental_devices SET activation_status = 'deactivated', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deviceId]
        );
        return { success: true, message: 'Device deactivated (local)' };
      }

      const vendorId = await this.getMachineVendorId();

      const { data, error } = await this.supabase
        .rpc('deactivate_rental_device', {
          p_device_id: device.cloud_device_id,
          p_vendor_id: vendorId
        });

      if (error) {
        console.error('[RentalActivation] Deactivate error:', error);
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        await db.run(
          `UPDATE rental_devices SET activation_status = 'deactivated', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deviceId]
        );
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Deactivate exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reactivate a previously deactivated/expired device
   * Restores it to trial status with a new 7-day trial period
   */
  async reactivateDevice(deviceId) {
    if (!this.supabase) {
      // Local only - reset to trial with new 7-day period
      const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        `UPDATE rental_devices SET activation_status = 'trial', deactivated_at = NULL, trial_expires_at = ?, accepted_by_vendor = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [trialExpires, deviceId]
      );
      return { success: true, message: 'Device reactivated with 7-day trial (local)', trial_expires_at: trialExpires };
    }

    try {
      const device = await db.get('SELECT cloud_device_id FROM rental_devices WHERE id = ?', [deviceId]);
      if (!device || !device.cloud_device_id) {
        // No cloud ID - do local reactivation
        const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db.run(
          `UPDATE rental_devices SET activation_status = 'trial', deactivated_at = NULL, trial_expires_at = ?, accepted_by_vendor = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [trialExpires, deviceId]
        );
        return { success: true, message: 'Device reactivated with 7-day trial (local)', trial_expires_at: trialExpires };
      }

      const vendorId = await this.getMachineVendorId();

      // Try cloud reactivation
      const { data, error } = await this.supabase
        .rpc('reactivate_rental_device', {
          p_device_id: device.cloud_device_id,
          p_vendor_id: vendorId
        });

      if (error) {
        console.warn('[RentalActivation] Cloud reactivate error, falling back to local:', error);
        // Fallback to local reactivation
        const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db.run(
          `UPDATE rental_devices SET activation_status = 'trial', deactivated_at = NULL, trial_expires_at = ?, accepted_by_vendor = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [trialExpires, deviceId]
        );
        return { success: true, message: 'Device reactivated locally (cloud error)', trial_expires_at: trialExpires };
      }

      if (data && data.success) {
        const trialExpires = data.trial_expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db.run(
          `UPDATE rental_devices SET activation_status = 'trial', deactivated_at = NULL, trial_expires_at = ?, accepted_by_vendor = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [trialExpires, deviceId]
        );
      }

      return data;
    } catch (err) {
      console.error('[RentalActivation] Reactivate exception:', err);
      // Fallback to local
      try {
        const trialExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await db.run(
          `UPDATE rental_devices SET activation_status = 'trial', deactivated_at = NULL, trial_expires_at = ?, accepted_by_vendor = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [trialExpires, deviceId]
        );
        return { success: true, message: 'Device reactivated locally (exception fallback)', trial_expires_at: trialExpires };
      } catch (e2) {
        return { success: false, error: err.message };
      }
    }
  }

  /**
   * Get all activation keys for this vendor
   */
  async getActivationKeys() {
    if (!this.supabase) {
      return [];
    }

    try {
      const vendorId = await this.getMachineVendorId();
      const { data, error } = await this.supabase
        .from('rental_activation_keys')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[RentalActivation] Get keys error:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[RentalActivation] Get keys exception:', err);
      return [];
    }
  }

  /**
   * Generate activation keys (superadmin only, but we call from server with service key)
   */
  async generateKeys(count = 1, licenseType = 'standard', expirationMonths = null) {
    if (!this.supabase) {
      // Generate local keys
      const keys = [];
      for (let i = 0; i < count; i++) {
        const key = 'RENT-' + 
          Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
          Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
          Math.random().toString(36).substring(2, 6).toUpperCase();
        keys.push({ activation_key: key, license_type: licenseType, expires_at: null });
      }
      return keys;
    }

    try {
      const vendorId = await this.getMachineVendorId();

      const { data, error } = await this.supabase
        .rpc('generate_rental_activation_keys', {
          batch_size: count,
          assigned_vendor_id: vendorId,
          license_type_param: licenseType,
          expiration_months: expirationMonths
        });

      if (error) {
        console.error('[RentalActivation] Generate keys error:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[RentalActivation] Generate keys exception:', err);
      return [];
    }
  }

  // ====== CLOUD SYNC METHODS ======

  /**
   * Force-sync a single local device record up to Supabase.
   * Uses the upsert_rental_device RPC which handles both INSERT and UPDATE.
   */
  async syncDeviceToCloud(device) {
    if (!this.supabase) return { success: false, reason: 'no_supabase' };
    try {
      const vendorId  = await this.getMachineVendorId();
      const machineId = await this.getMachineId();

      const { data, error } = await this.supabase.rpc('upsert_rental_device', {
        p_mac_address:        device.mac_address.toUpperCase(),
        p_android_id:         device.android_id  || null,
        p_device_name:        device.device_name || null,
        p_model:              device.model       || null,
        p_ip_address:         device.ip_address  || null,
        p_vendor_id:          vendorId           || null,
        p_machine_id:         machineId          || null,
        p_activation_status:  device.activation_status || 'trial',
        p_accepted_by_vendor: device.accepted_by_vendor ? true : false,
        p_trial_started_at:   device.trial_started_at  || null,
        p_trial_expires_at:   device.trial_expires_at  || null,
        p_activation_key:     device.activation_key    || null,
        p_license_expires_at: device.license_expires_at|| null,
        // Revenue & stats — always push latest local values
        p_total_revenue:      device.total_revenue  != null ? device.total_revenue  : null,
        p_total_rentals:      device.total_rentals  != null ? device.total_rentals  : null,
        p_total_sessions:     device.total_sessions != null ? device.total_sessions : null,
        p_last_rented_at:     device.last_rented_at   || null,
        p_last_returned_at:   device.last_returned_at || null
      });

      if (error) {
        console.error(`[RentalActivation] syncDeviceToCloud error for ${device.mac_address}:`, error);
        return { success: false, error: error.message };
      }

      // Update local cloud_device_id if returned
      if (data && data.device_id && data.device_id !== device.cloud_device_id) {
        await db.run(
          'UPDATE rental_devices SET cloud_device_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [data.device_id, device.id]
        );
        console.log(`[RentalActivation] cloud_device_id updated for ${device.device_name}: ${data.device_id}`);
      }

      return { success: true, data };
    } catch (err) {
      console.error(`[RentalActivation] syncDeviceToCloud exception for ${device.mac_address}:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sync all local rental_devices to Supabase.
   * Designed to be called on server startup or via admin trigger.
   */
  async syncAllDevicesToCloud() {
    if (!this.supabase) {
      console.warn('[RentalActivation] syncAllDevicesToCloud: no Supabase, skipping');
      return;
    }
    try {
      const devices = await db.all('SELECT * FROM rental_devices');
      if (!devices.length) return;

      console.log(`[RentalActivation] Syncing ${devices.length} device(s) to Supabase...`);
      for (const device of devices) {
        const result = await this.syncDeviceToCloud(device);
        if (result.success) {
          console.log(`[RentalActivation] Synced: ${device.device_name} (${device.mac_address}) → ${result.data?.action || 'ok'}`);
        }
      }
      console.log('[RentalActivation] syncAllDevicesToCloud complete');
    } catch (err) {
      console.error('[RentalActivation] syncAllDevicesToCloud exception:', err);
    }
  }

  /**
   * Sync a single local session to Supabase via upsert_rental_session RPC.
   */
  async syncSessionToCloud(session, cloudDeviceId) {
    if (!this.supabase) return { success: false, reason: 'no_supabase' };
    if (!cloudDeviceId) return { success: false, reason: 'no_cloud_device_id' };
    try {
      const vendorId  = await this.getMachineVendorId();
      const machineId = await this.getMachineId();
      const { data, error } = await this.supabase.rpc('upsert_rental_session', {
        p_local_session_id:         session.id,
        p_device_cloud_id:          cloudDeviceId,
        p_vendor_id:                vendorId  || null,
        p_machine_id:               machineId || null,
        p_customer_name:            session.customer_name    || null,
        p_customer_contact:         session.customer_contact || null,
        p_start_time:               session.start_time       || null,
        p_end_time:                 session.end_time         || null,
        p_duration_minutes:         session.duration_minutes || 0,
        p_amount_paid:              session.amount_paid      || 0,
        p_status:                   session.status           || 'completed',
        p_notes:                    session.notes            || null,
        p_kiosk_logout_at:          session.kiosk_logout_at  || null,
        p_paused_remaining_seconds: session.paused_remaining_seconds || null,
        p_kiosk_logout_reason:      session.kiosk_logout_reason || null,
        p_payment_method:           session.payment_method   || 'cash'
      });
      if (error) {
        console.error(`[RentalActivation] syncSessionToCloud error (session #${session.id}):`, error);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      console.error(`[RentalActivation] syncSessionToCloud exception (session #${session.id}):`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sync all local rental_sessions to Supabase.
   * Only syncs sessions whose device has a cloud_device_id.
   */
  async syncAllSessionsToCloud() {
    if (!this.supabase) {
      console.warn('[RentalActivation] syncAllSessionsToCloud: no Supabase, skipping');
      return;
    }
    try {
      const sessions = await db.all(`
        SELECT rs.*, rd.cloud_device_id
        FROM rental_sessions rs
        JOIN rental_devices rd ON rs.device_id = rd.id
        WHERE rd.cloud_device_id IS NOT NULL
        ORDER BY rs.start_time DESC
      `);
      if (!sessions.length) {
        console.log('[RentalActivation] syncAllSessionsToCloud: no sessions with cloud_device_id');
        return;
      }
      console.log(`[RentalActivation] Syncing ${sessions.length} session(s) to Supabase...`);
      let ok = 0, fail = 0;
      for (const s of sessions) {
        const result = await this.syncSessionToCloud(s, s.cloud_device_id);
        result.success ? ok++ : fail++;
      }
      console.log(`[RentalActivation] syncAllSessionsToCloud complete: ${ok} ok, ${fail} failed`);
    } catch (err) {
      console.error('[RentalActivation] syncAllSessionsToCloud exception:', err);
    }
  }

  /**
   * Sync revenue/stats for a single device to Supabase.
   * Called immediately after a session ends or a new session starts.
   * Uses the fast sync_device_revenue RPC (no full upsert).
   */
  async syncDeviceRevenue(deviceId) {
    try {
      if (!this.supabase) return;
      const device = await db.get(
        'SELECT id, cloud_device_id, total_revenue, total_rentals, total_sessions FROM rental_devices WHERE id = ?',
        [deviceId]
      );
      if (!device || !device.cloud_device_id) return;

      const { error } = await this.supabase.rpc('sync_device_revenue', {
        p_device_cloud_id: device.cloud_device_id,
        p_total_revenue:   device.total_revenue  || 0,
        p_total_rentals:   device.total_rentals  || 0,
        p_total_sessions:  device.total_sessions || 0
      });
      if (error) {
        console.error(`[RentalActivation] syncDeviceRevenue error (device ${deviceId}):`, error.message);
      } else {
        console.log(`[RentalActivation] Revenue synced for device ${deviceId}: $${device.total_revenue} (${device.total_rentals} rentals)`);
      }
    } catch (err) {
      console.error(`[RentalActivation] syncDeviceRevenue exception (device ${deviceId}):`, err.message);
    }
  }

  // ====== HELPER METHODS ======

  /**
   * Get the vendor_id for this machine from EdgeSync data
   * Reads from 'config' table key 'cloud_vendor_id'
   */
  async getMachineVendorId() {
    try {
      // Primary: live edgeSync instance (already authenticated)
      const edgeSync = getEdgeSync();
      if (edgeSync && edgeSync.vendorId) return edgeSync.vendorId;

      // Secondary: config table (where edge-sync persists it)
      const row = await db.get('SELECT value FROM config WHERE key = ?', ['cloud_vendor_id']);
      if (row && row.value) return row.value;

      // Fallback: vendor_id.json file
      const fs = require('fs');
      const path = require('path');
      const vendorFile = path.join(__dirname, '..', 'data', 'vendor_id.json');
      if (fs.existsSync(vendorFile)) {
        const vData = JSON.parse(fs.readFileSync(vendorFile, 'utf8'));
        if (vData.vendorId) return vData.vendorId;
      }
    } catch (e) { }
    return null;
  }

  /**
   * Get the machine_id (Supabase UUID) for this machine
   * Reads from live edgeSync instance or config table
   */
  async getMachineId() {
    try {
      // Primary: live edgeSync instance
      const edgeSync = getEdgeSync();
      if (edgeSync && edgeSync.machineId) return edgeSync.machineId;

      // Secondary: config table
      const row = await db.get('SELECT value FROM config WHERE key = ?', ['machine_id']);
      if (row && row.value) return row.value;
    } catch (e) { }
    return null;
  }

  /**
   * Sync Supabase registration data to local DB
   */
  async syncToLocal(macAddress, cloudData) {
    try {
      const updateFields = [];
      const updateValues = [];

      if (cloudData.device_id) {
        updateFields.push('cloud_device_id = ?');
        updateValues.push(cloudData.device_id);
      }
      if (cloudData.activation_status) {
        updateFields.push('activation_status = ?');
        updateValues.push(cloudData.activation_status);
      }
      if (cloudData.trial_expires_at) {
        updateFields.push('trial_started_at = CURRENT_TIMESTAMP');
        updateFields.push('trial_expires_at = ?');
        updateValues.push(cloudData.trial_expires_at);
      }
      if (cloudData.trial_key) {
        updateFields.push('activation_key = ?');
        updateValues.push(cloudData.trial_key);
      }

      if (updateFields.length > 0) {
        updateValues.push(macAddress.toUpperCase());
        await db.run(
          `UPDATE rental_devices SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE mac_address = ?`,
          updateValues
        );
      }
    } catch (err) {
      console.error('[RentalActivation] Sync to local error:', err);
    }
  }

  /**
   * Sync activation status from cloud check back to local
   */
  async syncActivationStatus(macAddress, cloudData) {
    try {
      const updates = [];
      const values = [];

      if (cloudData.activation_status) {
        updates.push('activation_status = ?');
        values.push(cloudData.activation_status);
      }
      if (cloudData.device_id) {
        updates.push('cloud_device_id = ?');
        values.push(cloudData.device_id);
      }
      if (cloudData.accepted_by_vendor !== undefined) {
        updates.push('accepted_by_vendor = ?');
        values.push(cloudData.accepted_by_vendor ? 1 : 0);
      }
      if (cloudData.license_key) {
        updates.push('activation_key = ?');
        values.push(cloudData.license_key);
      }
      if (cloudData.expires_at) {
        updates.push('license_expires_at = ?');
        values.push(cloudData.expires_at);
      }

      if (updates.length > 0) {
        values.push(macAddress.toUpperCase());
        await db.run(
          `UPDATE rental_devices SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE mac_address = ?`,
          values
        );
      }
    } catch (err) {
      console.error('[RentalActivation] Sync activation status error:', err);
    }
  }

  /**
   * Local-only status check fallback
   */
  async checkLocalStatus(macAddress) {
    try {
      const device = await db.get('SELECT * FROM rental_devices WHERE mac_address = ?', [macAddress.toUpperCase()]);

      if (!device) {
        return { success: false, can_operate: false, activation_status: 'unregistered' };
      }

      const now = new Date();
      const trialExpires = device.trial_expires_at ? new Date(device.trial_expires_at) : null;
      const licenseExpires = device.license_expires_at ? new Date(device.license_expires_at) : null;

      // Auto-expire check
      let status = device.activation_status;
      let canOperate = true;

      if (status === 'trial' && trialExpires && now >= trialExpires) {
        status = 'expired';
        canOperate = false;
        await db.run(`UPDATE rental_devices SET activation_status = 'expired', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`, [device.id]);
      } else if (status === 'active' && licenseExpires && now >= licenseExpires) {
        status = 'expired';
        canOperate = false;
        await db.run(`UPDATE rental_devices SET activation_status = 'expired', deactivated_at = CURRENT_TIMESTAMP WHERE id = ?`, [device.id]);
      } else if (status === 'deactivated' || status === 'rejected') {
        canOperate = false;
      } else if (!device.accepted_by_vendor && status === 'pending') {
        canOperate = true; // Still in pending, allow limited operation
      }

      return {
        success: true,
        can_operate: canOperate,
        activation_status: status,
        device_id: device.cloud_device_id || device.id,
        device_name: device.device_name,
        mac_address: macAddress,
        accepted_by_vendor: !!device.accepted_by_vendor,
        is_trial: status === 'trial',
        trial_expires_at: device.trial_expires_at,
        expires_at: device.license_expires_at,
        message: status === 'expired' ? 'License or trial has expired' :
                 status === 'deactivated' ? 'Device has been deactivated' :
                 status === 'rejected' ? 'Device has been rejected' :
                 'Device active'
      };
    } catch (err) {
      console.error('[RentalActivation] Local check error:', err);
      return { success: false, can_operate: false, error: err.message };
    }
  }
}

module.exports = new RentalActivationManager();
