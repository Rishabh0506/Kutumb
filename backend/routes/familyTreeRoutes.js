const express = require('express');
const router = express.Router();
const { buildFamilyTreeData } = require('../utils/treeBuilder');
const { verifyToken } = require('../middleware/authMiddleware');
const { getFamilyRole } = require('../models/collaboratorModel');

router.get('/:family_id', verifyToken, async (req, res, next) => {
  try {
    const my_role = await getFamilyRole(req.params.family_id, req.user.id);
    if (!my_role) {
      return res.status(404).json({ message: 'Family not found' });
    }

    const data = await buildFamilyTreeData(req.params.family_id);
    res.json({ ...data, my_role });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
