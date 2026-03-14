const express = require('express');
const router = express.Router();
const sensorController = require('../controllers/sensorController');

router.post('/sensor-data', sensorController.receiveSensorData);
router.get('/sensor-data/latest', sensorController.getLatestData);
router.get('/sensor-data/history/:deviceId', sensorController.getDeviceHistory);

router.post('/devices', sensorController.registerDevice);
router.get('/devices', sensorController.getAllDevices);
router.get('/devices/:deviceId', sensorController.getDeviceDetails);
router.delete('/devices/:deviceId', sensorController.deleteDevice);

router.get('/alerts', sensorController.getActiveAlerts);
router.delete('/alerts/:alertId', sensorController.clearAlert);

module.exports = router;
