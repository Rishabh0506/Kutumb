const express = require('express');
const router = express.Router({ mergeParams: true });
const collaboratorController = require('../controllers/collaboratorController');
const { verifyToken } = require('../middleware/authMiddleware');

// Mounted under /api/families/:family_id/collaborators — see familyRoutes.js
router.post('/', verifyToken, collaboratorController.addCollaborator);
router.get('/', verifyToken, collaboratorController.listCollaborators);
router.put('/:user_id', verifyToken, collaboratorController.updateCollaboratorRole);
router.delete('/:user_id', verifyToken, collaboratorController.removeCollaborator);

module.exports = router;
