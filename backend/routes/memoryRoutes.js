const express = require('express');
const router = express.Router();
const memoryController = require('../controllers/memoryController');
const { verifyToken } = require('../middleware/authMiddleware');

// Define memory routes (protected)
router.post('/', verifyToken, memoryController.createMemory);
router.get('/family/:family_id', verifyToken, memoryController.getMemoriesByFamily);
router.get('/person/:person_id', verifyToken, memoryController.getMemoriesByPerson);
router.delete('/:memory_id', verifyToken, memoryController.deleteMemory);

module.exports = router;
