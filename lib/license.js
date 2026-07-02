const { createClient } = require('@supabase/supabase-js');
const { getUniqueHardwareId } = require('./hardware');
const db = require('./db');
const { CloudLicenseClient, DEFAULT_LICENSE_API_URL } = require('./cloud-license-client');

class LicenseManager {
  constructor(supabaseUrl, supabaseKey) {
    // Allow configuration via environment variables or constructor
    this.supabaseUrl = supabaseUrl || process.env.SUPABASE_URL || '';
    this.supabaseKey = supabaseKey || process.env.SUPABASE_ANON_KEY || '';
    this.cloudClient = new CloudLicenseClient();
    this.useCloudApi = String(process.env.RJD_USE_CLOUD_LICENSE_API || 'true').toLowerCase() !== 'false';

    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
      console.log('[License] Supabase client initialized');
    } else {
      console.warn('[License] Supabase credentials not provided. Legacy Supabase verification disabled.');
    }

    if (this.useCloudApi) {
      console.log(`[License] Cloud licensing API enabled: ${process.env.RJD_LICENSE_API_URL || DEFAULT_LICENSE_API_URL}`);
    }
  }

  /**
   * Activate a license key by binding it to the current hardware
   * @param {string} licenseKey The license key to activate
   * @returns {Promise<{ success: boolean; message: string; license?: object }>} Success status and message
   */
  async activateDevice(licenseKey) {
    if (this.useCloudApi) {
      try {
        const hardwareId = await getUniqueHardwareId();
        const result = await this.cloudClient.activate({
          hardwareId,
          licenseKey,
          email: process.env.RJD_LICENSE_EMAIL || '',
          password: process.env.RJD_LICENSE_PASSWORD || '',
          deviceName: process.env.RJD_DEVICE_NAME || ''
        });

        const entitlement = result.entitlement || result.license || result;
        await this.cloudClient.cacheEntitlement(hardwareId, entitlement);
        return {
          success: true,
          message: result.message || 'License activated through RJD Cloud.',
          license: entitlement
        };
      } catch (cloudError) {
        console.error('[License] Cloud activation failed:', cloudError.message);
        if (!this.cloudClient.allowLocalFallback) {
          return {
            success: false,
            message: cloudError.message || 'Cloud activation failed. Internet and RJD Cloud access are required.'
          };
        }
        console.warn('[License] Local activation fallback is explicitly enabled.');
      }
    }

    if (!this.supabase) {
      // If Supabase isn't configured, try to activate using local database only
      try {
        const hardwareId = await getUniqueHardwareId();
        console.log(`[License] Attempting local activation with hardware ID: ${hardwareId}`);
        
        // Check if this hardware is already activated locally
        const existingLocal = await db.get('SELECT * FROM license_info WHERE hardware_id = ?', [hardwareId]);
        
        if (existingLocal) {
          if (existingLocal.license_key === licenseKey) {
            return { 
              success: true, 
              message: 'Device already activated with this license key.',
              license: { 
                id: existingLocal.id,
                license_key: existingLocal.license_key,
                hardware_id: existingLocal.hardware_id,
                is_active: existingLocal.is_active,
                activated_at: existingLocal.activated_at,
                created_at: existingLocal.created_at
              }
            };
          } else {
            return { 
              success: false, 
              message: 'This device is already bound to a different license key. Contact support for reassignment.' 
            };
          }
        }
        
        // Check if the license key exists in local database and is available
        const localLicense = await db.get('SELECT * FROM license_info WHERE license_key = ? AND hardware_id IS NULL', [licenseKey]);
        
        if (!localLicense) {
          // Try to add this license key to local database (for offline activation)
          try {
            await db.run(
              'INSERT INTO license_info (hardware_id, license_key, is_active, activated_at) VALUES (?, ?, 1, ?)', 
              [hardwareId, licenseKey, new Date().toISOString()]
            );
            
            console.log('[License] Local license activated successfully');
            return { 
              success: true, 
              message: 'License activated successfully! Your device is now authorized.',
              license: { 
                id: null,
                license_key: licenseKey,
                hardware_id: hardwareId,
                is_active: true,
                activated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              }
            };
          } catch (insertErr) {
            console.error('[License] Error inserting local license:', insertErr);
            return { success: false, message: 'Failed to activate license locally.' };
          }
        } else {
          // License exists locally but is not active
          try {
            await db.run('UPDATE license_info SET hardware_id = ?, is_active = 1, activated_at = ? WHERE license_key = ?', 
              [hardwareId, new Date().toISOString(), licenseKey]);
            
            console.log('[License] Local license activated successfully');
            return { 
              success: true, 
              message: 'License activated successfully! Your device is now authorized.',
              license: { 
                id: localLicense.id,
                license_key: licenseKey,
                hardware_id: hardwareId,
                is_active: true,
                activated_at: new Date().toISOString(),
                created_at: localLicense.created_at
              }
            };
          } catch (updateErr) {
            console.error('[License] Error updating local license:', updateErr);
            return { success: false, message: 'Failed to activate license locally.' };
          }
        }
      } catch (localError) {
        console.error('[License] Local activation error:', localError);
        return { 
          success: false, 
          message: localError.message || 'An unexpected error occurred during local activation.' 
        };
      }
    }

    try {
      // Get hardware ID
      const hardwareId = await getUniqueHardwareId();
      console.log(`[License] Attempting activation with hardware ID: ${hardwareId}`);

      // Check if this hardware is already activated
      const { data: existingHardware, error: hwError } = await this.supabase
        .from('licenses')
        .select('*')
        .eq('hardware_id', hardwareId)
        .maybeSingle();

      if (hwError) {
        console.error('[License] Error checking existing hardware:', hwError);
        return { success: false, message: `Database error: ${hwError.message}` };
      }

      if (existingHardware) {
        if (existingHardware.license_key === licenseKey) {
          // Also update local database
          await db.run(
            'INSERT OR REPLACE INTO license_info (hardware_id, license_key, is_active, activated_at, expires_at, created_at) VALUES (?, ?, 1, ?, ?, ?)', 
            [hardwareId, existingHardware.license_key, existingHardware.activated_at || new Date().toISOString(), existingHardware.expires_at || null, existingHardware.created_at]
          );
          
          return { 
            success: true, 
            message: 'Device already activated with this license key.',
            license: existingHardware 
          };
        } else {
          return { 
            success: false, 
            message: 'This device is already bound to a different license key. Contact support for reassignment.' 
          };
        }
      }

      // Check if the license key exists and is available
      const { data: license, error: licenseError } = await this.supabase
        .from('licenses')
        .select('*')
        .eq('license_key', licenseKey)
        .maybeSingle();

      if (licenseError) {
        console.error('[License] Error fetching license:', licenseError);
        return { success: false, message: `Database error: ${licenseError.message}` };
      }

      if (!license) {
        // The license key doesn't exist in Supabase, but we'll try to add it locally for offline usage
        console.log('[License] License key not found in Supabase, adding locally for offline use');
        
        try {
          await db.run(
            'INSERT OR REPLACE INTO license_info (hardware_id, license_key, is_active, activated_at) VALUES (?, ?, 1, ?)', 
            [hardwareId, licenseKey, new Date().toISOString()]
          );
          
          console.log('[License] Local license activated for offline use');
          return { 
            success: true, 
            message: 'License activated successfully for offline use! Your device is now authorized.',
            license: { 
              id: null,
              license_key: licenseKey,
              hardware_id: hardwareId,
              is_active: true,
              activated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            }
          };
        } catch (localErr) {
          console.error('[License] Error storing local license:', localErr);
          return { success: false, message: 'License not found and failed to store locally.' };
        }
      }

      if (license.hardware_id !== null) {
        return { 
          success: false, 
          message: 'This license key is already activated on another device. Contact vendor for additional licenses.' 
        };
      }

      // Activate the license by binding hardware_id
      const { data: updatedLicense, error: updateError } = await this.supabase
        .from('licenses')
        .update({ 
          hardware_id: hardwareId, 
          is_active: true,
          activated_at: new Date().toISOString()
        })
        .eq('license_key', licenseKey)
        .select()
        .single();

      if (updateError) {
        console.error('[License] Error activating license:', updateError);
        return { success: false, message: `Activation failed: ${updateError.message}` };
      }

      // Store the activation in local database as well for offline access
      await db.run(
        'INSERT OR REPLACE INTO license_info (hardware_id, license_key, is_active, activated_at, expires_at, created_at) VALUES (?, ?, 1, ?, ?, ?)', 
        [hardwareId, updatedLicense.license_key, updatedLicense.activated_at, updatedLicense.expires_at || null, updatedLicense.created_at]
      );

      console.log('[License] Device activated successfully');
      return { 
        success: true, 
        message: 'License activated successfully! Your device is now authorized.',
        license: updatedLicense 
      };

    } catch (error) {
      console.error('[License] Activation error:', error);
      return { 
        success: false, 
        message: error.message || 'An unexpected error occurred during activation.' 
      };
    }
  }

  /**
   * Fetch license from Supabase and cache it locally
   */
  async fetchAndCacheLicense(hardwareId) {
    if (this.useCloudApi) {
      try {
        const result = await this.cloudClient.verify({ hardwareId });
        const entitlement = result.entitlement || result.license || result;
        await this.cloudClient.cacheEntitlement(hardwareId, entitlement);
        return Boolean(entitlement.isValid || entitlement.isActivated || entitlement.status === 'active' || entitlement.status === 'trial');
      } catch (cloudError) {
        console.warn('[License] Cloud cache refresh failed:', cloudError.message);
        return false;
      }
    }

    if (!this.supabase) return false;
    
    try {
      // Prefer the vendors table for revocation status (RLS often disabled there)
      try {
        const { data: vendorRow } = await this.supabase
          .from('vendors')
          .select('is_revoked')
          .eq('hardware_id', hardwareId)
          .maybeSingle();

        if (vendorRow && vendorRow.is_revoked) {
          await db.run('UPDATE license_info SET is_active = 0, is_revoked = 1 WHERE hardware_id = ?', [hardwareId]);
          return false;
        }
      } catch (e) {}

      console.log(`[License] Fetching license for hardware ID: ${hardwareId}`);
      const { data: license, error } = await this.supabase
        .from('licenses')
        .select('*')
        .eq('hardware_id', hardwareId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
          console.error('[License] Error fetching license:', error);
          return false;
      }
      
      if (!license) {
          console.log('[License] No active license found in cloud for this hardware ID');
          // Do not assume revocation from absence; revocation is tracked via vendors.is_revoked
          return false;
      }

      await db.run(
        'INSERT OR REPLACE INTO license_info (hardware_id, license_key, is_active, is_revoked, activated_at, expires_at, created_at) VALUES (?, ?, 1, 0, ?, ?, ?)', 
        [hardwareId, license.license_key, license.activated_at || new Date().toISOString(), license.expires_at || null, license.created_at || new Date().toISOString()]
      );
      console.log(`[License] Synced license ${license.license_key} from cloud`);
      return true;
    } catch (e) {
      console.error('[License] Failed to sync license:', e);
      return false;
    }
  }

  /**
   * Verify if the current device has a valid license
   * @returns {Promise<{isValid: boolean, isActivated: boolean, error?: string, licenseKey?: string, expiresAt?: Date}>} License verification status
   */
  async verifyLicense() {
    if (this.useCloudApi) {
      const hardwareId = await getUniqueHardwareId();
      try {
        const result = await this.cloudClient.verify({ hardwareId });
        const entitlement = result.entitlement || result.license || result;
        await this.cloudClient.cacheEntitlement(hardwareId, entitlement);
        return {
          isValid: Boolean(entitlement.isValid || entitlement.is_valid || entitlement.status === 'active' || entitlement.status === 'trial'),
          isActivated: Boolean(entitlement.isActivated || entitlement.is_activated || entitlement.licenseKey || entitlement.license_key || entitlement.status === 'trial'),
          isRevoked: Boolean(entitlement.isRevoked || entitlement.is_revoked || entitlement.status === 'revoked'),
          licenseKey: entitlement.licenseKey || entitlement.license_key,
          licenseType: entitlement.licenseType || entitlement.license_type,
          expiresAt: entitlement.expiresAt || entitlement.expires_at ? new Date(entitlement.expiresAt || entitlement.expires_at) : undefined,
          maxClients: entitlement.maxClients || entitlement.max_clients,
          blockedFeatures: entitlement.blockedFeatures || entitlement.blocked_features || [],
          source: 'rjd-cloud'
        };
      } catch (cloudError) {
        console.warn('[License] Cloud verification failed:', cloudError.message);
        const cached = await this.cloudClient.getCachedEntitlement(hardwareId);
        if (cached && cached.isValid) {
          console.log('[License] Using cached cloud entitlement within offline grace window');
          return {
            isValid: true,
            isActivated: Boolean(cached.isActivated),
            isRevoked: Boolean(cached.isRevoked),
            licenseKey: cached.licenseKey,
            licenseType: cached.licenseType || cached.license_type,
            expiresAt: cached.expiresAt ? new Date(cached.expiresAt) : undefined,
            maxClients: cached.maxClients || cached.max_clients,
            blockedFeatures: cached.blockedFeatures || cached.blocked_features || [],
            source: 'rjd-cloud-cache',
            offline: true
          };
        }

        if (!this.cloudClient.allowLocalFallback) {
          return {
            isValid: false,
            isActivated: false,
            isRevoked: Boolean(cached && cached.isRevoked),
            error: cloudError.message || 'Cloud verification failed',
            source: 'rjd-cloud'
          };
        }
        console.warn('[License] Legacy local verification fallback is explicitly enabled.');
      }
    }

    if (!this.supabase) {
      // If Supabase isn't configured, try local database
      try {
        const hardwareId = await getUniqueHardwareId();
        
        const localLicense = await db.get('SELECT * FROM license_info WHERE hardware_id = ? AND is_active = 1', [hardwareId]);
        
        if (localLicense) {
          console.log('[License] Valid local license found');
          return { 
            isValid: true, 
            isActivated: true,
            isRevoked: Boolean(localLicense.is_revoked),
            licenseKey: localLicense.license_key,
            expiresAt: localLicense.expires_at ? new Date(localLicense.expires_at) : undefined
          };
        } else {
          console.warn('[License] No local license found');
          // Check if it was revoked
          const revokedLicense = await db.get('SELECT * FROM license_info WHERE hardware_id = ? AND is_revoked = 1', [hardwareId]);
          return { 
            isValid: false, 
            isActivated: false, 
            isRevoked: !!revokedLicense,
            error: 'No active license found for this device' 
          };
        }
      } catch (localError) {
        console.error('[License] Local verification error:', localError);
        return { 
          isValid: false, 
          isActivated: false, 
          error: localError.message 
        };
      }
    }

    try {
      const hardwareId = await getUniqueHardwareId();

      // Cloud revocation flag (via vendors table) should hard-stop trial/operation.
      // This avoids depending on licenses RLS rules.
      try {
        const { data: vendorRow } = await this.supabase
          .from('vendors')
          .select('is_revoked')
          .eq('hardware_id', hardwareId)
          .maybeSingle();

        if (vendorRow && vendorRow.is_revoked) {
          await db.run('UPDATE license_info SET is_active = 0, is_revoked = 1 WHERE hardware_id = ?', [hardwareId]);
          return {
            isValid: false,
            isActivated: false,
            isRevoked: true,
            error: 'Machine has been revoked'
          };
        }
      } catch (e) {}
      
      // Fetch ANY license for this hardware, even inactive/revoked ones
      const { data: license, error } = await this.supabase
        .from('licenses')
        .select('*')
        .eq('hardware_id', hardwareId)
        .maybeSingle();

      if (error) {
        console.error('[License] Remote verification error:', error);
        
        // If remote verification fails, try local database as fallback
        try {
          const localLicense = await db.get('SELECT * FROM license_info WHERE hardware_id = ? AND is_active = 1', [hardwareId]);
          
          if (localLicense) {
            console.log('[License] Fallback: Valid local license found');
            return { 
              isValid: true, 
              isActivated: true,
              isRevoked: Boolean(localLicense.is_revoked),
              licenseKey: localLicense.license_key,
              expiresAt: localLicense.expires_at ? new Date(localLicense.expires_at) : undefined
            };
          }
        } catch (fallbackError) {
          console.error('[License] Fallback verification also failed:', fallbackError);
        }
        
        // Check if revoked locally
        const revoked = await db.get('SELECT * FROM license_info WHERE hardware_id = ? AND is_revoked = 1', [hardwareId]);

        return { 
          isValid: false, 
          isActivated: false, 
          isRevoked: !!revoked,
          error: error.message 
        };
      }

      if (!license) {
        // No license record in cloud for this hardware.
        // This is NOT automatically revocation; rely on vendors.is_revoked for that.
        return { 
          isValid: false, 
          isActivated: false, 
          isRevoked: false,
          error: 'No license found for this device' 
        };
      }

      // If license exists but is NOT active, it is REVOKED
      if (!license.is_active) {
        console.log('[License] License found in cloud but is NOT active (Revoked)');
        await db.run('UPDATE license_info SET is_active = 0, is_revoked = 1 WHERE hardware_id = ?', [hardwareId]);
        return { 
          isValid: false, 
          isActivated: false, 
          isRevoked: true,
          licenseKey: license.license_key,
          error: 'License has been revoked'
        };
      }

      // Valid and Active License
      // Update local cache to ensure it's marked as active and NOT revoked
      await db.run(
        'INSERT OR REPLACE INTO license_info (hardware_id, license_key, is_active, is_revoked, activated_at, expires_at, created_at) VALUES (?, ?, 1, 0, ?, ?, ?)', 
        [hardwareId, license.license_key, license.activated_at || new Date().toISOString(), license.expires_at || null, license.created_at || new Date().toISOString()]
      );

      return { 
        isValid: true, 
        isActivated: true,
        isRevoked: false,
        licenseKey: license.license_key,
        expiresAt: license.expires_at ? new Date(license.expires_at) : undefined
      };

    } catch (error) {
      console.error('[License] Verification error:', error);
      
      // Try local database as ultimate fallback
      try {
        const hardwareId = await getUniqueHardwareId();
        const localLicense = await db.get('SELECT * FROM license_info WHERE hardware_id = ? AND is_active = 1', [hardwareId]);
        
        if (localLicense) {
          console.log('[License] Ultimate fallback: Valid local license found');
          return { 
            isValid: true, 
            isActivated: true,
            isRevoked: Boolean(localLicense.is_revoked),
            licenseKey: localLicense.license_key,
            expiresAt: localLicense.expires_at ? new Date(localLicense.expires_at) : undefined
          };
        }
      } catch (ultimateFallbackError) {
        console.error('[License] Ultimate fallback also failed:', ultimateFallbackError);
      }
      
      // Final check for revocation
      let isRevoked = false;
      try {
        const hardwareId = await getUniqueHardwareId();
        const revoked = await db.get('SELECT * FROM license_info WHERE hardware_id = ? AND is_revoked = 1', [hardwareId]);
        isRevoked = !!revoked;
      } catch (e) {}

      return { 
        isValid: false, 
        isActivated: false, 
        isRevoked: isRevoked,
        error: error.message 
      };
    }
  }

  /**
   * Get the hardware ID of the current device
   */
  async getDeviceHardwareId() {
    return await getUniqueHardwareId();
  }

  /**
   * Check if Supabase is configured
   */
  isConfigured() {
    return this.supabase !== null;
  }
}

// Singleton instance
let licenseManager = null;

function initializeLicenseManager(supabaseUrl, supabaseKey) {
  if (!licenseManager) {
    licenseManager = new LicenseManager(supabaseUrl, supabaseKey);
  }
  return licenseManager;
}

function getLicenseManager() {
  if (!licenseManager) {
    licenseManager = new LicenseManager();
  }
  return licenseManager;
}

module.exports.LicenseManager = LicenseManager;
module.exports.initializeLicenseManager = initializeLicenseManager;
module.exports.getLicenseManager = getLicenseManager;
