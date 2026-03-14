const validationService = require('../services/validationService');
const socketService = require('../services/socketService');

// In-memory data storage
const registeredDevices = new Map(); // User-registered devices (name + id)
const devices = new Map();           // Runtime device state (online/offline, readings)
const sensorReadings = new Map();
const alerts = new Map();

const DEVICE_TIMEOUT = parseInt(process.env.DEVICE_TIMEOUT) || 30000;
const MAX_READINGS_PER_DEVICE = parseInt(process.env.MAX_READINGS_PER_DEVICE) || 1000;

/**
 * Register a new device
 * POST /api/devices
 */
const registerDevice = async (req, res) => {
  try {
    const { deviceId, name } = req.body;

    if (!deviceId || !name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: deviceId and name are required',
      });
    }

    if (registeredDevices.has(deviceId)) {
      return res.status(409).json({
        success: false,
        message: `Device with id "${deviceId}" is already registered`,
      });
    }

    const device = { deviceId, name, registeredAt: new Date() };
    registeredDevices.set(deviceId, device);

    socketService.broadcast('device-registered', device);

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      data: device,
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Delete a registered device
 * DELETE /api/devices/:deviceId
 */
const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!registeredDevices.has(deviceId)) {
      return res.status(404).json({ success: false, message: `Device not found: ${deviceId}` });
    }

    registeredDevices.delete(deviceId);
    devices.delete(deviceId);
    sensorReadings.delete(deviceId);

    socketService.broadcast('device-deleted', { deviceId });

    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Receive sensor data from Arduino/IoT devices
 * POST /api/sensor-data
 */
const receiveSensorData = async (req, res) => {
  try {
    const { deviceId, ph, temperature, turbidity, conductivity, latitude, longitude } = req.body;

    if (!deviceId || ph === undefined || temperature === undefined ||
        turbidity === undefined || conductivity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Required: deviceId, ph, temperature, turbidity, conductivity',
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
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
        timestamp: new Date().toISOString(),
      });
    }

    const timestamp = new Date();
    const registered = registeredDevices.get(deviceId);

    const device = {
      deviceId,
      name: registered ? registered.name : deviceId,
      lastSeen: timestamp,
      latitude: latitude || null,
      longitude: longitude || null,
      status: 'connected',
      latestReading: {
        ph: parseFloat(ph),
        temperature: parseFloat(temperature),
        turbidity: parseFloat(turbidity),
        conductivity: parseFloat(conductivity),
        timestamp,
      },
    };

    devices.set(deviceId, device);

    // Attach the frontend-expected shape for the socket broadcast
    const broadcastDevice = {
      ...device,
      location: { latitude: device.latitude, longitude: device.longitude },
      readings: device.latestReading || null,
    };

    const reading = {
      id: `${deviceId}-${timestamp.getTime()}`,
      deviceId,
      ph: parseFloat(ph),
      temperature: parseFloat(temperature),
      turbidity: parseFloat(turbidity),
      conductivity: parseFloat(conductivity),
      timestamp,
      latitude: latitude || null,
      longitude: longitude || null,
    };

    if (!sensorReadings.has(deviceId)) {
      sensorReadings.set(deviceId, []);
    }

    const deviceReadings = sensorReadings.get(deviceId);
    deviceReadings.push(reading);

    if (deviceReadings.length > MAX_READINGS_PER_DEVICE) {
      deviceReadings.shift();
    }

    const alerts_generated = checkThresholds(deviceId, reading);

    socketService.broadcast('sensor-data', {
      device: broadcastDevice,
      reading,
      alerts: alerts_generated,
    });

    res.status(201).json({
      success: true,
      message: 'Sensor data received successfully',
      data: {
        deviceId,
        timestamp,
        alerts_generated: alerts_generated.length,
      },
    });
  } catch (error) {
    console.error('Error processing sensor data:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get latest sensor data from all registered devices
 * GET /api/sensor-data/latest
 */
const getLatestData = async (req, res) => {
  try {
    const latestData = [];
    const now = new Date();

    for (const [deviceId, registered] of registeredDevices) {
      const runtime = devices.get(deviceId);
      const timeSinceLastSeen = runtime ? now - runtime.lastSeen : Infinity;
      const isConnected = runtime && timeSinceLastSeen < DEVICE_TIMEOUT;

      if (runtime && !isConnected && runtime.status === 'connected') {
        runtime.status = 'disconnected';
        devices.set(deviceId, runtime);
      }

      latestData.push({
        deviceId,
        name: registered.name,
        status: isConnected ? 'connected' : 'disconnected',
        lastSeen: runtime ? runtime.lastSeen : null,
        location: {
          latitude: runtime ? runtime.latitude : null,
          longitude: runtime ? runtime.longitude : null,
        },
        readings: runtime ? runtime.latestReading || null : null,
      });
    }

    res.json({ success: true, data: latestData, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting latest data:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get historical data for a specific device
 * GET /api/sensor-data/history/:deviceId
 */
const getDeviceHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24, limit = 100 } = req.query;

    if (!sensorReadings.has(deviceId)) {
      return res.status(404).json({ success: false, message: `No data found for device: ${deviceId}` });
    }

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - parseInt(hours));

    const allReadings = sensorReadings.get(deviceId);
    const filteredReadings = allReadings
      .filter((r) => r.timestamp >= cutoffTime)
      .slice(-parseInt(limit));

    res.json({
      success: true,
      deviceId,
      data: filteredReadings,
      count: filteredReadings.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting device history:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get all registered devices with status
 * GET /api/devices
 */
const getAllDevices = async (req, res) => {
  try {
    const deviceList = [];
    const now = new Date();

    for (const [deviceId, registered] of registeredDevices) {
      const runtime = devices.get(deviceId);
      const timeSinceLastSeen = runtime ? now - runtime.lastSeen : Infinity;
      const isConnected = runtime && timeSinceLastSeen < DEVICE_TIMEOUT;

      if (runtime && !isConnected && runtime.status === 'connected') {
        runtime.status = 'disconnected';
        devices.set(deviceId, runtime);
      }

      deviceList.push({
        deviceId,
        name: registered.name,
        status: isConnected ? 'connected' : 'disconnected',
        lastSeen: runtime ? runtime.lastSeen : null,
        location: {
          latitude: runtime ? runtime.latitude : null,
          longitude: runtime ? runtime.longitude : null,
        },
        readings: runtime ? runtime.latestReading || null : null,
        registeredAt: registered.registeredAt,
      });
    }

    res.json({ success: true, data: deviceList, count: deviceList.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get specific device details
 * GET /api/devices/:deviceId
 */
const getDeviceDetails = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const registered = registeredDevices.get(deviceId);

    if (!registered) {
      return res.status(404).json({ success: false, message: `Device not found: ${deviceId}` });
    }

    const runtime = devices.get(deviceId);
    const now = new Date();
    const timeSinceLastSeen = runtime ? now - runtime.lastSeen : Infinity;
    const isConnected = runtime && timeSinceLastSeen < DEVICE_TIMEOUT;

    res.json({
      success: true,
      data: {
        deviceId,
        name: registered.name,
        status: isConnected ? 'connected' : 'disconnected',
        lastSeen: runtime ? runtime.lastSeen : null,
        latitude: runtime ? runtime.latitude : null,
        longitude: runtime ? runtime.longitude : null,
        latestReading: runtime ? runtime.latestReading : null,
        registeredAt: registered.registeredAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting device details:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Get active alerts
 * GET /api/alerts
 */
const getActiveAlerts = async (req, res) => {
  try {
    const activeAlerts = Array.from(alerts.values())
      .filter((alert) => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({ success: true, data: activeAlerts, count: activeAlerts.length, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

/**
 * Clear specific alert
 * DELETE /api/alerts/:alertId
 */
const clearAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    if (!alerts.has(alertId)) {
      return res.status(404).json({ success: false, message: `Alert not found: ${alertId}` });
    }

    const alert = alerts.get(alertId);
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alerts.set(alertId, alert);

    socketService.broadcast('alert-resolved', { alertId });

    res.json({ success: true, message: 'Alert resolved successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error clearing alert:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

function checkThresholds(deviceId, reading) {
  const alerts_generated = [];
  const thresholds = validationService.getThresholds();

  if (reading.ph < thresholds.ph.min) {
    alerts_generated.push(createAlert(deviceId, 'ph', 'low', reading.ph, thresholds.ph.min));
  } else if (reading.ph > thresholds.ph.max) {
    alerts_generated.push(createAlert(deviceId, 'ph', 'high', reading.ph, thresholds.ph.max));
  }

  if (reading.temperature < thresholds.temperature.min) {
    alerts_generated.push(createAlert(deviceId, 'temperature', 'low', reading.temperature, thresholds.temperature.min));
  } else if (reading.temperature > thresholds.temperature.max) {
    alerts_generated.push(createAlert(deviceId, 'temperature', 'high', reading.temperature, thresholds.temperature.max));
  }

  if (reading.turbidity > thresholds.turbidity.max) {
    alerts_generated.push(createAlert(deviceId, 'turbidity', 'high', reading.turbidity, thresholds.turbidity.max));
  }

  if (reading.conductivity < thresholds.conductivity.min) {
    alerts_generated.push(createAlert(deviceId, 'conductivity', 'low', reading.conductivity, thresholds.conductivity.min));
  } else if (reading.conductivity > thresholds.conductivity.max) {
    alerts_generated.push(createAlert(deviceId, 'conductivity', 'high', reading.conductivity, thresholds.conductivity.max));
  }

  return alerts_generated;
}

function createAlert(deviceId, parameter, type, value, threshold) {
  const alertId = `alert-${deviceId}-${parameter}-${Date.now()}`;
  const registered = registeredDevices.get(deviceId);
  const alert = {
    id: alertId,
    deviceId,
    deviceName: registered ? registered.name : deviceId,
    parameter,
    type,
    value,
    threshold,
    severity: getAlertSeverity(parameter, value, threshold, type),
    message: getAlertMessage(parameter, type, value, threshold),
    timestamp: new Date(),
    resolved: false,
  };

  alerts.set(alertId, alert);
  socketService.broadcast('alert', alert);

  return alert;
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

setInterval(() => {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000;
  for (const [alertId, alert] of alerts) {
    if (now - alert.timestamp > maxAge) {
      alerts.delete(alertId);
    }
  }
}, 60 * 60 * 1000);

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
