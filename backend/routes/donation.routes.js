const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donation.controller');

router.post('/blood/check-eligibility', donationController.checkBloodEligibility);
router.get('/blood/requests', donationController.getBloodRequests);
router.post('/blood/requests', donationController.createBloodRequest);
router.post('/blood/requests/:id/donate', donationController.donateBlood);
router.get('/fund/campaigns', donationController.getCampaigns);
router.post('/fund/campaigns/:id/donate', donationController.donateToCampaign);
router.post('/patient/requests', donationController.createAssistanceRequest);
router.post('/patient/requests/:id/donate', donationController.donateToPatient);

module.exports = router;
