const AuthController = require('../controllers/AuthController');
const SsoController = require('../controllers/SsoController');
const { authenticateToken } = require('../middleware/auth');

async function authRoutes(fastify, options) {
  // Public routes
  fastify.post('/register', AuthController.register);
  fastify.post('/login', AuthController.login);

  // === SSO Routes ===
  // Public SSO routes
  fastify.get('/sso/providers', SsoController.getProviders);
  fastify.get('/sso/init', SsoController.initSso);
  fastify.get('/sso/redirect', SsoController.redirectToProvider);
  fastify.get('/sso/callback', SsoController.handleCallback);
  fastify.post('/sso/callback', SsoController.handleCallbackPost);

  // Protected SSO routes (for linking/unlinking)
  fastify.post('/sso/link', { preHandler: [authenticateToken] }, SsoController.linkIdentity);
  fastify.delete('/sso/link/:provider', { preHandler: [authenticateToken] }, SsoController.unlinkIdentity);
  fastify.get('/sso/identities', { preHandler: [authenticateToken] }, SsoController.getIdentities);

  // Protected routes
  fastify.get('/profile', { preHandler: [authenticateToken] }, AuthController.getProfile);
  fastify.put('/profile', { preHandler: [authenticateToken] }, AuthController.updateProfile);
  fastify.put('/change-password', { preHandler: [authenticateToken] }, AuthController.changePassword);
  fastify.post('/set-password', { preHandler: [authenticateToken] }, AuthController.setPassword);
  fastify.post('/logout', { preHandler: [authenticateToken] }, AuthController.logout);
}

module.exports = authRoutes;
