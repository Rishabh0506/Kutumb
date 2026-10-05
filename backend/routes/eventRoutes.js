const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken } = require('../middleware/authMiddleware');

// Define events route (protected)
router.get('/', verifyToken, eventController.getFamilyEvents);

module.exports = router;
