const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/:family_id', verifyToken, reminderController.getUpcomingReminders);

module.exports = router;
