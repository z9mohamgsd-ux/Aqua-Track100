const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');
const { verifyToken } = require('../middleware/auth');

// IoT devices POST sensor data without auth — they use deviceId to identify
router.post('/sensor-data', sensorController.receiveSensorData);

// All other endpoints require a logged-in user
router.get('/sensor-data/latest', verifyToken, sensorController.getLatestData);
router.get('/sensor-data/history/:deviceId', verifyToken, sensorController.getDeviceHistory);

router.post('/devices', verifyToken, sensorController.registerDevice);
router.get('/devices', verifyToken, sensorController.getAllDevices);
router.get('/devices/:deviceId', verifyToken, sensorController.getDeviceDetails);
router.delete('/devices/:deviceId', verifyToken, sensorController.deleteDevice);

router.get('/alerts', verifyToken, sensorController.getActiveAlerts);
router.delete('/alerts/:alertId', verifyToken, sensorController.clearAlert);

module.exports = router;
