const pool = require('../db');
const validationService = require('../services/validationService');
const socketService = require('../services/socketService');

// In-memory runtime state: track connection status & last seen without hammering DB
const runtimeState = new Map(); // deviceId (text) -> { lastSeen, status }

const DEVICE_TIMEOUT = parseInt(process.env.DEVICE_TIMEOUT) || 30000;
const MAX_READINGS_PER_DEVICE = parseInt(process.env.MAX_READINGS_PER_DEVICE) || 1000;

/**
 * Resolve runtime status (connected / disconnected) for a device
 */
function getDeviceStatus(deviceId) {
  const state = runtimeState.get(deviceId);
  if (!state) return 'disconnected';
  return (Date.now() - state.lastSeen) < DEVICE_TIMEOUT ? 'connected' : 'disconnected';
}

/**
 * Register a new device
 * POST /api/devices  (requires auth)
 */
const registerDevice = async (req, res) => {
  try {
    const { deviceId, name } = req.body;
    const ownerId = req.user.id;

    if (!deviceId || !name) {
      return res.status(400).json({ success: false, message: 'Missing required fields: deviceId and name' });
    }

    // Check duplicate across all users (device_id is globally unique)
    const existing = await pool.query('SELECT id, owner_id FROM devices WHERE device_id = $1', [deviceId]);
    if (existing.rows.length) {
      return res.status(409).json({ success: false, message: `Device "${deviceId}" is already registered` });
    }

    const result = await pool.query(
      `INSERT INTO devices (device_id, name, owner_id, registered_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, device_id AS "deviceId", name, owner_id, registered_at`,
      [deviceId, name, ownerId]
    );

    const device = result.rows[0];
    socketService.broadcastToUser(ownerId, 'device-registered', device);

    return res.status(201).json({ success: true, message: 'Device registered successfully', data: device });
  } catch (error) {
    console.error('Error registering device:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Delete a registered device
 * DELETE /api/devices/:deviceId  (requires auth, must own device)
 */
const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const ownerId = req.user.id;

    const found = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1 AND owner_id = $2',
      [deviceId, ownerId]
    );
    if (!found.rows.length) {
      return res.status(404).json({ success: false, message: `Device not found: ${deviceId}` });
    }

    await pool.query('DELETE FROM devices WHERE device_id = $1 AND owner_id = $2', [deviceId, ownerId]);
    runtimeState.delete(deviceId);
    socketService.broadcastToUser(ownerId, 'device-deleted', { deviceId });

    return res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get all devices for the authenticated user
 * GET /api/devices  (requires auth)
 */
const getAllDevices = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const result = await pool.query(
      `SELECT id, device_id AS "deviceId", name, owner_id, registered_at,
              last_seen, last_lat, last_lng,
              last_ph, last_temperature, last_turbidity, last_conductivity
       FROM devices WHERE owner_id = $1 ORDER BY registered_at DESC`,
      [ownerId]
    );

    const deviceList = result.rows.map((d) => {
      const status = getDeviceStatus(d.deviceId);
      return {
        deviceId: d.deviceId,
        name: d.name,
        status,
        lastSeen: d.last_seen,
        registeredAt: d.registered_at,
        location: { latitude: d.last_lat, longitude: d.last_lng },
        readings: (d.last_ph !== null)
          ? {
              ph: d.last_ph,
              temperature: d.last_temperature,
              turbidity: d.last_turbidity,
              conductivity: d.last_conductivity,
              timestamp: d.last_seen,
            }
          : null,
      };
    });

    return res.json({ success: true, data: deviceList, count: deviceList.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting devices:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get specific device details — must own it
 * GET /api/devices/:deviceId  (requires auth)
 */
const getDeviceDetails = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const ownerId = req.user.id;

    const result = await pool.query(
      `SELECT id, device_id AS "deviceId", name, owner_id, registered_at,
              last_seen, last_lat, last_lng,
              last_ph, last_temperature, last_turbidity, last_conductivity
       FROM devices WHERE device_id = $1 AND owner_id = $2`,
      [deviceId, ownerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: `Device not found: ${deviceId}` });
    }

    const d = result.rows[0];
    const status = getDeviceStatus(d.deviceId);

    return res.json({
      success: true,
      data: {
        deviceId: d.deviceId,
        name: d.name,
        status,
        lastSeen: d.last_seen,
        latitude: d.last_lat,
        longitude: d.last_lng,
        latestReading: (d.last_ph !== null)
          ? {
              ph: d.last_ph,
              temperature: d.last_temperature,
              turbidity: d.last_turbidity,
              conductivity: d.last_conductivity,
              timestamp: d.last_seen,
            }
          : null,
        registeredAt: d.registered_at,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting device details:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Receive sensor data from Arduino/IoT devices — OPEN endpoint (no auth)
 * The IoT device identifies itself by deviceId.  Must be pre-registered.
 * POST /api/sensor-data
 */
const receiveSensorData = async (req, res) => {
  try {
    const { deviceId, ph, temperature, turbidity, conductivity, latitude, longitude } = req.body;

    if (!deviceId || ph === undefined || temperature === undefined ||
        turbidity === undefined || conductivity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId, ph, temperature, turbidity, conductivity',
        timestamp: new Date().toISOString(),
      });
    }

    const validation = validationService.validateSensorData({
      ph: parseFloat(ph),
      temperature: parseFloat(temperature),
      turbidity: parseFloat(turbidity),
      conductivity: parseFloat(conductivity),
    });

    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: validation.errors, timestamp: new Date().toISOString() });
    }

    // Find device in DB
    const deviceResult = await pool.query(
      'SELECT id, name, owner_id FROM devices WHERE device_id = $1',
      [deviceId]
    );
    if (!deviceResult.rows.length) {
      return res.status(404).json({ success: false, message: `Device not registered: ${deviceId}. Register first via the dashboard.`, timestamp: new Date().toISOString() });
    }

    const dbDevice = deviceResult.rows[0];
    const lat = latitude ?? null;
    const lng = longitude ?? null;
    const now = new Date();

    // Persist reading
    const readingResult = await pool.query(
      `INSERT INTO sensor_readings (device_id, ph, temperature, turbidity, conductivity, latitude, longitude, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, recorded_at`,
      [dbDevice.id, parseFloat(ph), parseFloat(temperature), parseFloat(turbidity), parseFloat(conductivity), lat, lng, now]
    );

    // Update device last-seen snapshot
    await pool.query(
      `UPDATE devices SET last_seen = $1, last_lat = $2, last_lng = $3,
          last_ph = $4, last_temperature = $5, last_turbidity = $6, last_conductivity = $7, status = 'connected'
       WHERE id = $8`,
      [now, lat, lng, parseFloat(ph), parseFloat(temperature), parseFloat(turbidity), parseFloat(conductivity), dbDevice.id]
    );

    // Trim old readings (keep latest MAX_READINGS_PER_DEVICE)
    pool.query(
      `DELETE FROM sensor_readings WHERE device_id = $1 AND id NOT IN (
         SELECT id FROM sensor_readings WHERE device_id = $1 ORDER BY recorded_at DESC LIMIT $2
       )`,
      [dbDevice.id, MAX_READINGS_PER_DEVICE]
    ).catch(() => {});

    // Update in-memory runtime state
    runtimeState.set(deviceId, { lastSeen: Date.now(), status: 'connected' });

    const reading = {
      id: readingResult.rows[0].id,
      deviceId,
      ph: parseFloat(ph),
      temperature: parseFloat(temperature),
      turbidity: parseFloat(turbidity),
      conductivity: parseFloat(conductivity),
      timestamp: now,
      latitude: lat,
      longitude: lng,
    };

    const devicePayload = {
      deviceId,
      name: dbDevice.name,
      status: 'connected',
      lastSeen: now,
      location: { latitude: lat, longitude: lng },
      readings: reading,
    };

    const alerts_generated = await checkThresholds(dbDevice.id, deviceId, dbDevice.name, dbDevice.owner_id, reading);

    // Broadcast only to device owner's socket room
    socketService.broadcastToUser(dbDevice.owner_id, 'sensor-data', { device: devicePayload, reading, alerts: alerts_generated });

    return res.status(201).json({
      success: true,
      message: 'Sensor data received successfully',
      data: { deviceId, timestamp: now, alerts_generated: alerts_generated.length },
    });
  } catch (error) {
    console.error('Error processing sensor data:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get latest readings for all of the authenticated user's devices
 * GET /api/sensor-data/latest  (requires auth)
 */
const getLatestData = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const result = await pool.query(
      `SELECT device_id AS "deviceId", name, last_seen, last_lat, last_lng,
              last_ph, last_temperature, last_turbidity, last_conductivity, registered_at
       FROM devices WHERE owner_id = $1 ORDER BY registered_at DESC`,
      [ownerId]
    );

    const latestData = result.rows.map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      status: getDeviceStatus(d.deviceId),
      lastSeen: d.last_seen,
      location: { latitude: d.last_lat, longitude: d.last_lng },
      readings: (d.last_ph !== null)
        ? { ph: d.last_ph, temperature: d.last_temperature, turbidity: d.last_turbidity, conductivity: d.last_conductivity, timestamp: d.last_seen }
        : null,
    }));

    return res.json({ success: true, data: latestData, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting latest data:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get historical readings for a specific device — must own it
 * GET /api/sensor-data/history/:deviceId  (requires auth)
 */
const getDeviceHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24, limit = 100 } = req.query;
    const ownerId = req.user.id;

    const deviceRow = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1 AND owner_id = $2',
      [deviceId, ownerId]
    );
    if (!deviceRow.rows.length) {
      return res.status(404).json({ success: false, message: `Device not found or not yours: ${deviceId}` });
    }

    const dbDeviceId = deviceRow.rows[0].id;
    const cutoff = new Date(Date.now() - parseInt(hours) * 3600 * 1000);

    const result = await pool.query(
      `SELECT id, ph, temperature, turbidity, conductivity, latitude, longitude, recorded_at AS timestamp
       FROM sensor_readings
       WHERE device_id = $1 AND recorded_at >= $2
       ORDER BY recorded_at DESC LIMIT $3`,
      [dbDeviceId, cutoff, parseInt(limit)]
    );

    const readings = result.rows.map((r) => ({ ...r, deviceId }));

    return res.json({ success: true, deviceId, data: readings, count: readings.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting device history:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get active alerts for authenticated user's devices
 * GET /api/alerts  (requires auth)
 */
const getActiveAlerts = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const result = await pool.query(
      `SELECT a.id, d.device_id AS "deviceId", d.name AS "deviceName",
              a.parameter, a.alert_type AS type, a.value, a.threshold,
              a.severity, a.message, a.triggered_at AS timestamp, a.resolved, a.resolved_at
       FROM active_alerts a
       JOIN devices d ON d.id = a.device_id
       WHERE d.owner_id = $1 AND a.resolved = FALSE
       ORDER BY a.triggered_at DESC`,
      [ownerId]
    );

    return res.json({ success: true, data: result.rows, count: result.rows.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting alerts:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Clear / resolve an alert — must own the device it belongs to
 * DELETE /api/alerts/:alertId  (requires auth)
 */
const clearAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const ownerId = req.user.id;

    const found = await pool.query(
      `SELECT a.id FROM active_alerts a
       JOIN devices d ON d.id = a.device_id
       WHERE a.id = $1 AND d.owner_id = $2`,
      [alertId, ownerId]
    );
    if (!found.rows.length) {
      return res.status(404).json({ success: false, message: `Alert not found: ${alertId}` });
    }

    await pool.query(
      'UPDATE active_alerts SET resolved = TRUE, resolved_at = NOW() WHERE id = $1',
      [alertId]
    );

    socketService.broadcastToUser(ownerId, 'alert-resolved', { alertId });

    return res.json({ success: true, message: 'Alert resolved successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error clearing alert:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ─── Threshold helpers ─────────────────────────────────────────────────────

async function checkThresholds(dbDeviceId, deviceId, deviceName, ownerId, reading) {
  const alerts_generated = [];
  const thresholds = validationService.getThresholds();

  const checks = [
    { param: 'ph',           type: reading.ph < thresholds.ph.min ? 'low' : reading.ph > thresholds.ph.max ? 'high' : null,                   value: reading.ph },
    { param: 'temperature',  type: reading.temperature < thresholds.temperature.min ? 'low' : reading.temperature > thresholds.temperature.max ? 'high' : null, value: reading.temperature },
    { param: 'turbidity',    type: reading.turbidity > thresholds.turbidity.max ? 'high' : null,                                               value: reading.turbidity },
    { param: 'conductivity', type: reading.conductivity < thresholds.conductivity.min ? 'low' : reading.conductivity > thresholds.conductivity.max ? 'high' : null, value: reading.conductivity },
  ];

  for (const check of checks) {
    if (!check.type) continue;
    const threshold = check.type === 'low' ? thresholds[check.param].min : thresholds[check.param].max;
    const severity = getAlertSeverity(check.param, check.value, threshold, check.type);
    const message = getAlertMessage(check.param, check.type, check.value, threshold);
    const alertId = `alert-${deviceId}-${check.param}-${Date.now()}`;

    try {
      await pool.query(
        `INSERT INTO active_alerts (id, device_id, parameter, alert_type, value, threshold, severity, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [alertId, dbDeviceId, check.param, check.type, check.value, threshold, severity, message]
      );

      const alert = {
        id: alertId,
        deviceId,
        deviceName,
        parameter: check.param,
        type: check.type,
        value: check.value,
        threshold,
        severity,
        message,
        timestamp: new Date(),
        resolved: false,
      };

      socketService.broadcastToUser(ownerId, 'alert', alert);
      alerts_generated.push(alert);
    } catch (err) {
      console.error('Error saving alert:', err.message);
    }
  }

  return alerts_generated;
}

function getAlertSeverity(parameter, value, threshold, type) {
  let deviation;
  switch (parameter) {
    case 'ph':
    case 'temperature':
      deviation = type === 'low' ? (threshold - value) / threshold : (value - threshold) / threshold;
      break;
    case 'turbidity':
      deviation = value / threshold;
      break;
    case 'conductivity':
      deviation = type === 'low' ? threshold / value : value / threshold;
      break;
    default:
      deviation = 0.1;
  }
  if (deviation > 0.5) return 'critical';
  if (deviation > 0.2) return 'warning';
  return 'info';
}

function getAlertMessage(parameter, type, value, threshold) {
  const messages = {
    ph: {
      low: `pH level is too low (${value.toFixed(2)}). Minimum safe level is ${threshold}.`,
      high: `pH level is too high (${value.toFixed(2)}). Maximum safe level is ${threshold}.`,
    },
    temperature: {
      low: `Water temperature is too low (${value.toFixed(1)}°C). Minimum safe temperature is ${threshold}°C.`,
      high: `Water temperature is too high (${value.toFixed(1)}°C). Maximum safe temperature is ${threshold}°C.`,
    },
    turbidity: {
      high: `Water turbidity is too high (${value.toFixed(1)} NTU). Maximum safe level is ${threshold} NTU.`,
    },
    conductivity: {
      low: `Water conductivity is too low (${value.toFixed(0)} µS/cm). Minimum safe level is ${threshold} µS/cm.`,
      high: `Water conductivity is too high (${value.toFixed(0)} µS/cm). Maximum safe level is ${threshold} µS/cm.`,
    },
  };
  return messages[parameter]?.[type] || `Alert: ${parameter} is ${type}`;
}

// Periodic cleanup: mark stale devices as disconnected in DB
setInterval(async () => {
  try {
    await pool.query(
      `UPDATE devices SET status = 'disconnected'
       WHERE status = 'connected' AND last_seen < NOW() - INTERVAL '${DEVICE_TIMEOUT} milliseconds'`
    );
  } catch {}
}, 60000);

module.exports = {
  registerDevice,
  deleteDevice,
  receiveSensorData,
  getLatestData,
  getDeviceHistory,
  getAllDevices,
  getDeviceDetails,
  getActiveAlerts,
  clearAlert,
};
