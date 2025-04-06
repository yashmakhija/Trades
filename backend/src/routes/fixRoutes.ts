import { Router } from 'express';
import { FixController } from '../controllers/fixController';
import { FixService } from '../services/fix/fixService';
import { fixConfig } from '../config/fix.config';

const router = Router();
const fixService = new FixService(fixConfig);
const fixController = new FixController(fixService);

// Session Management
router.get('/status', (req, res) => fixController.getSessionStatus(req, res));

// Market Data
router.post('/market-data/:symbol/subscribe', (req, res) => fixController.subscribeMarketData(req, res));
router.post('/market-data/:symbol/unsubscribe', (req, res) => fixController.unsubscribeMarketData(req, res));

// Order Management
router.post('/orders', (req, res) => fixController.placeOrder(req, res));
router.delete('/orders/:orderId/:clientOrderId', (req, res) => fixController.cancelOrder(req, res));

// Position Management
router.get('/positions', (req, res) => fixController.getAllPositions(req, res));
router.get('/positions/:symbol', (req, res) => fixController.getPosition(req, res));

export default router; 