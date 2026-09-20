const express = require('express');
const router = express.Router();
const { createIncident, getIncidents, getIncidentById } = require('../controllers/incidentController');

router.post('/', createIncident);
router.get('/', getIncidents);
router.get('/:id', getIncidentById);

module.exports = router;
