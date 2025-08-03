const ParticipantController = require('../controllers/ParticipantController');
const { authenticateToken } = require('../middleware/auth');

async function participantRoutes(fastify, options) {
  // All participant routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/events/:eventId/participants', ParticipantController.addParticipant);
  fastify.get('/events/:eventId/participants', ParticipantController.getParticipants);
  fastify.get('/events/:eventId/participants/export', ParticipantController.exportParticipants);
  fastify.post('/events/:eventId/participants/import', ParticipantController.importParticipants);

  fastify.get('/participants/:id', ParticipantController.getParticipantById);
  fastify.put('/participants/:id', ParticipantController.updateParticipant);
  fastify.delete('/participants/:id', ParticipantController.deleteParticipant);
}

module.exports = participantRoutes;
