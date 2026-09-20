const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        clientMessageId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        conversationId: {
            type: String,
            required: true,
            trim: true,
        },

        content: {
            type: String,
            required: true,
            trim: true,
        },

        createdAt: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;