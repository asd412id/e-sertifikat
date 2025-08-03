const jwt = require('fast-jwt');
const { User } = require('../models');
const { Op } = require('sequelize');

class AuthService {
  constructor() {
    this.signJWT = jwt.createSigner({
      key: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
    this.verifyJWT = jwt.createVerifier({
      key: process.env.JWT_SECRET
    });
  }

  async register(userData) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: userData.email },
            { username: userData.username }
          ]
        }
      });

      if (existingUser) {
        throw new Error('User with this email or username already exists');
      }

      // Create new user
      const user = await User.create(userData);

      // Generate token
      const token = this.signJWT({
        userId: user.id,
        username: user.username,
        email: user.email
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  async login(email, password) {
    try {
      // Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user || !user.isActive) {
        throw new Error('Invalid credentials');
      }

      // Validate password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Generate token
      const token = this.signJWT({
        userId: user.id,
        username: user.username,
        email: user.email
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName
        },
        token
      };
    } catch (error) {
      throw error;
    }
  }

  async verifyToken(token) {
    try {
      return this.verifyJWT(token);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async getUserById(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'username', 'email', 'fullName']
      });

      if (!user || !user.isActive) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(userId, profileData) {
    try {
      const user = await User.findByPk(userId);

      if (!user || !user.isActive) {
        throw new Error('User not found');
      }

      // Check if new username or email already exists (if being changed)
      if (profileData.username && profileData.username !== user.username) {
        const existingUser = await User.findOne({
          where: {
            username: profileData.username,
            id: { [Op.ne]: userId }
          }
        });
        if (existingUser) {
          throw new Error('Username already exists');
        }
      }

      if (profileData.email && profileData.email !== user.email) {
        const existingUser = await User.findOne({
          where: {
            email: profileData.email,
            id: { [Op.ne]: userId }
          }
        });
        if (existingUser) {
          throw new Error('Email already exists');
        }
      }

      // Update user profile
      await user.update({
        fullName: profileData.fullName || user.fullName,
        username: profileData.username || user.username,
        email: profileData.email || user.email
      });

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName
      };
    } catch (error) {
      throw error;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findByPk(userId);

      if (!user || !user.isActive) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await user.validatePassword(currentPassword);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      await user.update({ password: newPassword });

      return { message: 'Password updated successfully' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();
