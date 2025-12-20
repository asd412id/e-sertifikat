const EventController = require('../controllers/EventController');
const { authenticateToken } = require('../middleware/auth');

async function eventRoutes(fastify, options) {
  // All event routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/', EventController.createEvent);
  fastify.get('/', EventController.getEvents);
  fastify.get('/:id', EventController.getEventById);
  fastify.put('/:id', EventController.updateEvent);
  fastify.put('/:id/public-download-settings', EventController.updatePublicDownloadSettings);
  fastify.delete('/:id', EventController.deleteEvent);
  fastify.get('/:id/participant-fields', EventController.getEventParticipantFields);
}

module.exports = eventRoutes;
