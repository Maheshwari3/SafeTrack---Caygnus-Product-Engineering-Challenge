const Message = require('../models/Message');

// POST /api/messages
exports.createMessage = async (req, res) => {
  try {
    const {
      clientMessageId,
      conversationId,
      content,
      createdAt,
      simulateFailure,
      simulateLostAck,
    } = req.body;

    const shouldSimulateFailure =
      simulateFailure === true ||
      req.headers['x-simulate-failure'] === 'true';

    const shouldSimulateLostAck =
      simulateLostAck === true ||
      req.headers['x-simulate-lost-ack'] === 'true';

    // Simulated temporary failure (503 Service Unavailable)
    if (shouldSimulateFailure) {
      return res.status(503).json({
        error: 'Simulated temporary backend failure (Service Unavailable)',
      });
    }

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

    // Simulated lost acknowledgement:
    // The message is durably committed to the database, but the network
    // connection is dropped or a 500 error returned before the client
    // receives the 201 Created confirmation.
    if (shouldSimulateLostAck) {
      return res.status(500).json({
        error: 'Simulated lost acknowledgement: message saved but response failed',
      });
    }

    return res.status(201).json(savedMessage);
  } catch (error) {
    // MongoDB duplicate key = message was already stored.
    // This can happen when the original response was lost
    // and the mobile app retries the same message.
    if (
      error.code === 11000 ||
      (error.keyPattern && error.keyPattern.clientMessageId)
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

// DELETE /api/messages/reset (used for testing/benchmarks)
exports.resetMessages = async (req, res) => {
  try {
    const conversationId = req.query.conversationId || (req.body && req.body.conversationId);
    const filter = conversationId ? { conversationId } : {};
    await Message.deleteMany(filter);
    return res.status(200).json({ message: 'Messages reset successfully' });
  } catch (error) {
    console.error('Error resetting messages:', error);
    return res.status(500).json({ error: 'Failed to reset messages' });
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