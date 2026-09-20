const Message = require('../models/Message');

// POST /api/messages
exports.createMessage = async (req, res) => {
  try {
    const {
      clientMessageId,
      conversationId,
      content,
      createdAt,
    } = req.body;

    // Validate required fields
    if (!clientMessageId || !conversationId || !content || !createdAt) {
      return res.status(400).json({
        error: 'clientMessageId, conversationId, content and createdAt are required',
      });
    }

    const message = new Message({
      clientMessageId,
      conversationId,
      content,
      createdAt,
    });

    const savedMessage = await message.save();

    return res.status(201).json(savedMessage);
  } catch (error) {
    // MongoDB duplicate key = message was already stored.
    // This can happen when the original response was lost
    // and the mobile app retries the same message.
    if (
      error.code === 11000 &&
      error.keyPattern &&
      error.keyPattern.clientMessageId
    ) {
      const existingMessage = await Message.findOne({
        clientMessageId: req.body.clientMessageId,
      });

      return res.status(200).json(existingMessage);
    }

    console.error('Error creating message:', error);

    return res.status(500).json({
      error: 'Server error',
    });
  }
};

// GET /api/messages
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.query;

    const filter = conversationId ? { conversationId } : {};

    const messages = await Message.find(filter).sort({
      createdAt: 1,
      _id: 1,
    });

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);

    return res.status(500).json({
      error: 'Server error',
    });
  }
};