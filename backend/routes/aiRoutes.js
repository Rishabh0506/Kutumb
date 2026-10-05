const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middleware/authMiddleware');

// Define AI endpoints (protected)
router.post('/generate-biography', verifyToken, aiController.generateBiography);

module.exports = router;
