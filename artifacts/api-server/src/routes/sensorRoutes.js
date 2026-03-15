import { Router } from 'express';
import * as sensorController from '../controllers/sensorController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/sensor-data', sensorController.receiveSensorData);

router.get('/sensor-data/latest', verifyToken, sensorController.getLatestData);
router.get('/sensor-data/history/:deviceId', verifyToken, sensorController.getDeviceHistory);

router.post('/devices', verifyToken, sensorController.registerDevice);
router.get('/devices', verifyToken, sensorController.getAllDevices);
router.get('/devices/:deviceId', verifyToken, sensorController.getDeviceDetails);
router.delete('/devices/:deviceId', verifyToken, sensorController.deleteDevice);

router.get('/alerts', verifyToken, sensorController.getActiveAlerts);
router.delete('/alerts/:alertId', verifyToken, sensorController.clearAlert);

export default router;
