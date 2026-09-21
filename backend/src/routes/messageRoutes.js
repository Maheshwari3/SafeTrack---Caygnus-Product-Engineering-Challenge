const express = require('express');

const {
  createMessage,
  getMessages,
  resetMessages,
} = require('../controllers/messageController');

const router = express.Router();

router.post('/', createMessage);
router.get('/', getMessages);
router.delete('/reset', resetMessages);
router.post('/reset', resetMessages);

module.exports = router;