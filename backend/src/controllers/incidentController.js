const Incident = require('../models/Incident');

// @desc    Create a new incident (with idempotency)
// @route   POST /api/incidents
exports.createIncident = async (req, res) => {
  try {
    const { clientIncidentId, title, location, severity, description, createdAt } = req.body;

    // Validate required fields
    if (!clientIncidentId || !title || !location || !severity || !description) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Attempt to save the incident
    const newIncident = new Incident({
      clientIncidentId,
      title,
      location,
      severity,
      description,
      createdAt: createdAt || Date.now(),
    });

    const savedIncident = await newIncident.save();
    return res.status(201).json(savedIncident);
  } catch (error) {
    // 11000 is MongoDB's duplicate key error code
    if (error.code === 11000 && error.keyPattern && error.keyPattern.clientIncidentId) {
      // Idempotency: Incident already exists, fetch and return it as if it succeeded
      const existingIncident = await Incident.findOne({ clientIncidentId: req.body.clientIncidentId });
      return res.status(200).json(existingIncident);
    }
    
    console.error('Error creating incident:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get all incidents
// @route   GET /api/incidents
exports.getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    res.status(200).json(incidents);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// @desc    Get a single incident by ID
// @route   GET /api/incidents/:id
exports.getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.status(200).json(incident);
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
