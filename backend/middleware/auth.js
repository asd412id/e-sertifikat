const AuthService = require('../services/AuthService');

async function authenticateToken(request, reply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Access token required'
      });
    }

    const token = authHeader.substring(7);
    const decoded = await AuthService.verifyToken(token);

    // Add user info to request
    request.user = decoded;

  } catch (error) {
    return reply.status(401).send({
      error: 'Invalid or expired token'
    });
  }
}

module.exports = { authenticateToken };
