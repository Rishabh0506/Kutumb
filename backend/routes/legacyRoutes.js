const express = require('express');
const router = express.Router();
const legacyController = require('../controllers/legacyController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/:person_id', verifyToken, legacyController.createLegacyMessage);
router.get('/:person_id', verifyToken, legacyController.getLegacyMessages);

module.exports = router;
