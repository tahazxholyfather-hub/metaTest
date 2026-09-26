const express = require('express');
const paymentController = require('../controllers/paymentController');

const { requireToken } = require('../middleware/auth');

const router = express.Router();

router.get('/plans', paymentController.getSubscriptionPlans);
router.get('/entitlements', requireToken, paymentController.getEntitlements);
router.get('/coin-packages', requireToken, paymentController.getCoinPackages);
router.post('/coins/create', requireToken, paymentController.createCoinPayment);
router.post('/discount/validate', requireToken, paymentController.validateDiscountCode);
router.post('/create', requireToken, paymentController.createSubscriptionPayment);
router.get('/me', requireToken, paymentController.getMySubscriptionStatus);

// Zarinpal callback must stay public
router.get('/zarinpal/callback', paymentController.handleZarinpalCallback);

router.get('/result/:token', paymentController.getPaymentResult);


module.exports = router;

