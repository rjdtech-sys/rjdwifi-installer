/**
 * ServiceManager - Controls Phone Rental and MikroTik service lifecycle
 * Enables graceful startup/shutdown to reduce CPU/memory on SBC boards
 */

const db = require('./db');
const rentalActivation = require('./rental-activation');

// Service state tracking
const serviceState = {
  phoneRental: {
    enabled: true,
    intervals: [],     // Track setInterval IDs
    listeners: [],     // Track event listeners
    cache: null        // Cache for expensive operations
  },
  mikrotik: {
    enabled: true,
    connections: new Map(),  // Track active MikroTik connections
    intervals: [],
    listeners: []
  }
};

/**
 * Check if a service is enabled
 */
async function isServiceEnabled(serviceName) {
  try {
    const row = await db.get('SELECT value FROM config WHERE key = ?', [`service_${serviceName}_enabled`]);
    const enabled = row ? row.value === 'true' || row.value === '1' : true; // Default: enabled
    serviceState[serviceName].enabled = enabled;
    return enabled;
  } catch (e) {
    console.error(`[ServiceManager] Failed to check ${serviceName} status:`, e.message);
    return true; // Default to enabled on error
  }
}

/**
 * Enable or disable a service
 */
async function setServiceEnabled(serviceName, enabled) {
  try {
    await db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', 
      [`service_${serviceName}_enabled`, enabled ? 'true' : 'false']);
    
    serviceState[serviceName].enabled = enabled;
    console.log(`[ServiceManager] ${serviceName} ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (enabled) {
      await startService(serviceName);
    } else {
      await stopService(serviceName);
    }
    
    return { success: true, enabled };
  } catch (e) {
    console.error(`[ServiceManager] Failed to set ${serviceName} status:`, e.message);
    throw e;
  }
}

/**
 * Stop a service (graceful shutdown)
 */
async function stopService(serviceName) {
  console.log(`[ServiceManager] Stopping ${serviceName} service...`);
  
  try {
    if (serviceName === 'phoneRental') {
      await stopPhoneRental();
    } else if (serviceName === 'mikrotik') {
      await stopMikroTik();
    }
    
    console.log(`[ServiceManager] ${serviceName} stopped successfully`);
    return { success: true };
  } catch (e) {
    console.error(`[ServiceManager] Failed to stop ${serviceName}:`, e.message);
    throw e;
  }
}

/**
 * Start a service
 */
async function startService(serviceName) {
  console.log(`[ServiceManager] Starting ${serviceName} service...`);
  
  try {
    if (serviceName === 'phoneRental') {
      await startPhoneRental();
    } else if (serviceName === 'mikrotik') {
      await startMikroTik();
    }
    
    console.log(`[ServiceManager] ${serviceName} started successfully`);
    return { success: true };
  } catch (e) {
    console.error(`[ServiceManager] Failed to start ${serviceName}:`, e.message);
    throw e;
  }
}

/**
 * Stop Phone Rental service
 * - Clears all intervals
 * - Removes rental session monitors
 * - Frees memory
 */
async function stopPhoneRental() {
  console.log('[ServiceManager] Phone Rental shutdown:');
  
  // Clear all tracked intervals
  serviceState.phoneRental.intervals.forEach(intervalId => {
    clearInterval(intervalId);
    console.log(`  ✓ Cleared interval ${intervalId}`);
  });
  serviceState.phoneRental.intervals = [];
  
  // Clear cache
  serviceState.phoneRental.cache = null;
  
  console.log('  ✓ Phone Rental service stopped');
}

/**
 * Start Phone Rental service
 * - Initialize session monitors
 * - Start background tasks
 */
async function startPhoneRental() {
  console.log('[ServiceManager] Phone Rental startup:');
  
  // Phone rental is mostly request-driven (no background intervals needed)
  // Just clear any stale state
  serviceState.phoneRental.cache = null;
  
  console.log('  ✓ Phone Rental service started (request-driven mode)');
}

/**
 * Stop MikroTik service
 * - Close all active connections
 * - Clear connection pool
 * - Stop monitoring intervals
 */
async function stopMikroTik() {
  console.log('[ServiceManager] MikroTik shutdown:');
  
  // Close all active MikroTik connections
  for (const [routerId, connection] of serviceState.mikrotik.connections) {
    try {
      if (connection && typeof connection.close === 'function') {
        connection.close();
        console.log(`  ✓ Closed connection to router ${routerId}`);
      }
    } catch (e) {
      console.error(`  ✗ Error closing router ${routerId}:`, e.message);
    }
  }
  serviceState.mikrotik.connections.clear();
  
  // Clear all tracked intervals
  serviceState.mikrotik.intervals.forEach(intervalId => {
    clearInterval(intervalId);
    console.log(`  ✓ Cleared interval ${intervalId}`);
  });
  serviceState.mikrotik.intervals = [];
  
  console.log('  ✓ MikroTik service stopped');
}

/**
 * Start MikroTik service
 * - Reinitialize connection pool
 * - Start monitoring (if needed)
 */
async function startMikroTik() {
  console.log('[ServiceManager] MikroTik startup:');
  
  // MikroTik connections are created on-demand
  // Just clear stale state
  serviceState.mikrotik.connections.clear();
  
  console.log('  ✓ MikroTik service started (on-demand connection mode)');
}

/**
 * Register an interval for tracking (so it can be cleared later)
 */
function registerInterval(serviceName, intervalId) {
  if (serviceState[serviceName] && serviceState[serviceName].intervals) {
    serviceState[serviceName].intervals.push(intervalId);
  }
}

/**
 * Register a MikroTik connection for tracking
 */
function registerMikroTikConnection(routerId, connection) {
  serviceState.mikrotik.connections.set(routerId, connection);
}

/**
 * Unregister a MikroTik connection
 */
function unregisterMikroTikConnection(routerId) {
  serviceState.mikrotik.connections.delete(routerId);
}

/**
 * Get status of all services
 */
async function getServiceStatus() {
  const phoneRentalEnabled = await isServiceEnabled('phoneRental');
  const mikrotikEnabled = await isServiceEnabled('mikrotik');
  
  return {
    phoneRental: {
      enabled: phoneRentalEnabled,
      activeIntervals: serviceState.phoneRental.intervals.length,
      cacheActive: serviceState.phoneRental.cache !== null
    },
    mikrotik: {
      enabled: mikrotikEnabled,
      activeConnections: serviceState.mikrotik.connections.size,
      activeIntervals: serviceState.mikrotik.intervals.length
    }
  };
}

/**
 * Initialize services on startup
 */
async function initializeServices() {
  console.log('[ServiceManager] Initializing services...');
  
  const phoneRentalEnabled = await isServiceEnabled('phoneRental');
  const mikrotikEnabled = await isServiceEnabled('mikrotik');
  
  console.log(`[ServiceManager] Phone Rental: ${phoneRentalEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`[ServiceManager] MikroTik: ${mikrotikEnabled ? 'ENABLED' : 'DISABLED'}`);
  
  if (!phoneRentalEnabled) {
    await stopPhoneRental();
  }
  
  if (!mikrotikEnabled) {
    await stopMikroTik();
  }
  
  console.log('[ServiceManager] Service initialization complete');
}

module.exports = {
  isServiceEnabled,
  setServiceEnabled,
  stopService,
  startService,
  registerInterval,
  registerMikroTikConnection,
  unregisterMikroTikConnection,
  getServiceStatus,
  initializeServices,
  serviceState
};
