const AuthController = require('../controllers/AuthController');
const { authenticateToken } = require('../middleware/auth');

async function authRoutes(fastify, options) {
  // Public routes
  fastify.post('/register', AuthController.register);
  fastify.post('/login', AuthController.login);

  // Protected routes
  fastify.get('/profile', { preHandler: [authenticateToken] }, AuthController.getProfile);
  fastify.put('/profile', { preHandler: [authenticateToken] }, AuthController.updateProfile);
  fastify.put('/change-password', { preHandler: [authenticateToken] }, AuthController.changePassword);
  fastify.post('/logout', { preHandler: [authenticateToken] }, AuthController.logout);
}

module.exports = authRoutes;
