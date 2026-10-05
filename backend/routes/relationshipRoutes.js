const express = require('express');
const router = express.Router();
const relationshipController = require('../controllers/relationshipController');
const { verifyToken } = require('../middleware/authMiddleware');

// Define relationship routes (protected)
router.post('/', verifyToken, relationshipController.createRelationship);
router.get('/:person_id', verifyToken, relationshipController.getRelationshipsByPerson);
router.delete('/:relationship_id', verifyToken, relationshipController.deleteRelationship);
router.put('/:relationship_id', verifyToken, relationshipController.updateRelationship);

module.exports = router;
