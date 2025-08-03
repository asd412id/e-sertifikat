const AuthService = require('../services/AuthService');

class AuthController {
  async register(request, reply) {
    try {
      const { username, email, password, fullName } = request.body;

      if (!username || !email || !password || !fullName) {
        return reply.status(400).send({
          error: 'Username, email, password, and full name are required'
        });
      }

      const result = await AuthService.register({
        username,
        email,
        password,
        fullName
      });

      reply.status(201).send({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async login(request, reply) {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({
          error: 'Email and password are required'
        });
      }

      const result = await AuthService.login(email, password);

      reply.send({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      reply.status(401).send({
        error: error.message
      });
    }
  }

  async getProfile(request, reply) {
    try {
      const user = await AuthService.getUserById(request.user.userId);

      reply.send({
        success: true,
        data: { user }
      });
    } catch (error) {
      reply.status(404).send({
        error: error.message
      });
    }
  }

  async logout(request, reply) {
    // Since we're using stateless JWT, logout is handled on the client side
    reply.send({
      success: true,
      message: 'Logout successful'
    });
  }

  async updateProfile(request, reply) {
    try {
      const { fullName, username, email } = request.body;

      if (!fullName || !username || !email) {
        return reply.status(400).send({
          error: 'Full name, username, and email are required'
        });
      }

      const user = await AuthService.updateProfile(request.user.userId, {
        fullName,
        username,
        email
      });

      reply.send({
        success: true,
        message: 'Profile updated successfully',
        data: { user }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async changePassword(request, reply) {
    try {
      const { currentPassword, newPassword } = request.body;

      if (!currentPassword || !newPassword) {
        return reply.status(400).send({
          error: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({
          error: 'New password must be at least 6 characters long'
        });
      }

      const result = await AuthService.changePassword(
        request.user.userId,
        currentPassword,
        newPassword
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();
