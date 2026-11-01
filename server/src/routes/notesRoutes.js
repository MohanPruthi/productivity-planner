const express = require('express');
const router = express.Router();
const notesController = require('../controllers/notesController');
const { authenticateToken } = require('../middleware/auth');

// Protect all note routes
router.use(authenticateToken);

router.get('/', notesController.getNotes);
router.get('/:id', notesController.getNoteById);
router.post('/', notesController.createNote);
router.patch('/:id/pin', notesController.togglePin);
router.patch('/:id', notesController.updateNote);
router.put('/:id', notesController.updateNote);
router.delete('/:id', notesController.deleteNote);

module.exports = router;
