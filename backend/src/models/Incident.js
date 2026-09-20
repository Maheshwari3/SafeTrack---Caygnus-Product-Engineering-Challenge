const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    clientIncidentId: {
      type: String,
      required: true,
      unique: true, // Crucial for idempotency
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;
