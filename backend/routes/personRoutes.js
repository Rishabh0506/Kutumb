const express = require('express');
const router = express.Router();
const personController = require('../controllers/personController');
const { verifyToken } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const { validateRequest } = require('../middleware/validationMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const rateLimit = require('express-rate-limit');
const { writableFamilyIdsSubquery } = require('../models/collaboratorModel');

// Dedicated rate limiter for file uploads (10 per 15 min)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many uploads from this IP, please try again later' },
});

// ── Photo upload (multer disk storage) ──────────────────────
const uploadDir = path.join(__dirname, '../uploads/persons');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    cb(null, `person_${req.params.person_id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Upload / replace photo for a person
router.post(
  '/:person_id/photo',
  verifyToken,
  uploadLimiter,
  upload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const baseUrl  = `${req.protocol}://${req.get('host')}`;
      const photoUrl = `${baseUrl}/uploads/persons/${req.file.filename}`;
      const { rows } = await pool.query(
        `UPDATE persons SET photo_url = $1
         WHERE id = $2
           AND family_id IN ${writableFamilyIdsSubquery(3)}
         RETURNING *`,
        [photoUrl, req.params.person_id, req.user.id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Person not found' });
      }
      res.json({ photo_url: photoUrl });
    } catch (err) {
      console.error('Photo upload error:', err);
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
);

// Define person routes (protected)
router.post(
  '/',
  verifyToken,
  [
    body('first_name').notEmpty().trim().escape().withMessage('First name is required'),
    body('last_name').optional().trim().escape(),
    body('family_id').notEmpty().withMessage('Family ID is required'),
    body('gender').optional().isIn(['Male', 'Female', 'Other', '']).withMessage('Invalid gender value'),
    body('birth_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid birth date format'),
    body('death_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid death date format'),
    body('bio').optional().trim().isLength({ max: 5000 }).withMessage('Bio cannot exceed 5000 characters'),
    body('occupation').optional().trim().escape(),
    body('birth_place').optional().trim().escape(),
  ],
  validateRequest,
  personController.addPerson
);

// Search persons (must come before /:person_id to avoid conflict)
router.get('/search', verifyToken, personController.searchPersons);
router.get('/family/:family_id', verifyToken, personController.getPersonsByFamily);
router.get('/:person_id', verifyToken, personController.getPersonById);

router.put(
  '/:person_id',
  verifyToken,
  [
    body('first_name').optional().notEmpty().trim().escape().withMessage('First name cannot be blank'),
    body('last_name').optional().trim().escape(),
    body('gender').optional().isIn(['Male', 'Female', 'Other', '']).withMessage('Invalid gender value'),
    body('birth_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid birth date format'),
    body('death_date').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid death date format'),
    body('bio').optional().trim().isLength({ max: 5000 }).withMessage('Bio cannot exceed 5000 characters'),
    body('occupation').optional().trim().escape(),
    body('birth_place').optional().trim().escape(),
  ],
  validateRequest,
  personController.updatePerson
);

router.delete('/:person_id', verifyToken, personController.deletePerson);

module.exports = router;

