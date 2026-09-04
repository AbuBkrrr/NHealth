const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');

router.get('/schemes', insuranceController.getSchemes);
router.post('/enroll', insuranceController.enroll);
router.post('/nhis/verify', insuranceController.verifyNHIS);
router.post('/claims', insuranceController.submitClaim);
router.get('/claims', insuranceController.getClaims);

module.exports = router;
