const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');

router.get('/', pharmacyController.getPharmacies);
router.get('/:id/inventory', pharmacyController.getInventory);
router.post('/orders', pharmacyController.createOrder);
router.get('/orders', pharmacyController.getOrders);
router.put('/orders/:id', pharmacyController.updateOrder);

module.exports = router;
