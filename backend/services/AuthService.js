const jwt = require('fast-jwt');
const { User, UserIdentity } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

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

  /**
   * Generate a random password for SSO users (they won't use it)
   */
  _generateRandomPassword() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate unique username from email or name
   */
  async _generateUniqueUsername(baseUsername) {
    let username = baseUsername.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 40);
    
    if (username.length < 3) {
      username = 'user' + username;
    }

    let candidate = username;
    let counter = 1;

    while (await User.findOne({ where: { username: candidate } })) {
      candidate = `${username}${counter}`;
      counter++;
      if (counter > 1000) {
        // Fallback to random suffix
        candidate = `${username}${crypto.randomBytes(4).toString('hex')}`;
        break;
      }
    }

    return candidate;
  }

  /**
   * Find or create user from SSO profile
   * @param {object} ssoProfile - Normalized SSO profile
   * @param {object} tokenData - Token data from SSO provider
   */
  async findOrCreateSsoUser(ssoProfile, tokenData = {}) {
    const { provider, providerId, email, name, username: ssoUsername } = ssoProfile;

    // 1. Check if identity already exists
    let identity = await UserIdentity.findOne({
      where: { provider, providerId },
      include: [{ model: User, as: 'user' }]
    });

    if (identity && identity.user) {
      // Update last login and tokens
      await identity.update({
        lastLoginAt: new Date(),
        accessToken: tokenData.accessToken || identity.accessToken,
        refreshToken: tokenData.refreshToken || identity.refreshToken,
        tokenExpiresAt: tokenData.expiresIn 
          ? new Date(Date.now() + tokenData.expiresIn * 1000) 
          : identity.tokenExpiresAt,
        providerEmail: email || identity.providerEmail,
        providerData: ssoProfile.raw || identity.providerData
      });

      return {
        user: identity.user,
        identity,
        isNewUser: false
      };
    }

    // 2. Check if user with same email exists (auto-link if enabled)
    let user = null;
    const autoLinkByEmail = process.env.SSO_AUTO_LINK_BY_EMAIL !== 'false'; // Default true

    if (email && autoLinkByEmail) {
      user = await User.findOne({ where: { email } });
    }

    // 3. Create new user if not found
    if (!user) {
      const baseUsername = ssoUsername || (email ? email.split('@')[0] : `user_${providerId.substring(0, 8)}`);
      const uniqueUsername = await this._generateUniqueUsername(baseUsername);

      user = await User.create({
        username: uniqueUsername,
        email: email || `${provider}_${providerId}@sso.local`, // Fallback email for SSO without email
        password: this._generateRandomPassword(),
        fullName: name || uniqueUsername,
        isActive: true,
        hasPassword: false // SSO users don't have a manual password initially
      });
    }

    // 4. Create identity link
    identity = await UserIdentity.create({
      userId: user.id,
      provider,
      providerId,
      providerEmail: email,
      providerData: ssoProfile.raw,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresIn 
        ? new Date(Date.now() + tokenData.expiresIn * 1000) 
        : null,
      lastLoginAt: new Date()
    });

    // Determine if this is a new user (was created in step 3)
    const isNewUser = user._options?.isNewRecord || false;

    return {
      user,
      identity,
      isNewUser
    };
  }

  /**
   * Link SSO identity to existing authenticated user
   */
  async linkSsoIdentity(userId, ssoProfile, tokenData = {}) {
    const { provider, providerId, email } = ssoProfile;

    // Check if identity already linked to another user
    const existingIdentity = await UserIdentity.findOne({
      where: { provider, providerId }
    });

    if (existingIdentity) {
      if (existingIdentity.userId === userId) {
        // Already linked to this user, just update
        await existingIdentity.update({
          lastLoginAt: new Date(),
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          providerEmail: email,
          providerData: ssoProfile.raw
        });
        return existingIdentity;
      }
      throw new Error('This SSO account is already linked to another user');
    }

    // Create new link
    const identity = await UserIdentity.create({
      userId,
      provider,
      providerId,
      providerEmail: email,
      providerData: ssoProfile.raw,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresIn 
        ? new Date(Date.now() + tokenData.expiresIn * 1000) 
        : null,
      lastLoginAt: new Date()
    });

    return identity;
  }

  /**
   * Unlink SSO identity from user
   */
  async unlinkSsoIdentity(userId, provider) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has password set (can still login without SSO)
    const identities = await UserIdentity.findAll({ where: { userId } });
    
    if (identities.length <= 1 && !user.hasPassword) {
      // User has no password and this is their only SSO identity
      throw new Error('Tidak dapat memutuskan koneksi SSO. Anda harus mengatur kata sandi terlebih dahulu agar tetap bisa masuk ke akun.');
    }

    const result = await UserIdentity.destroy({
      where: { userId, provider }
    });

    if (result === 0) {
      throw new Error('SSO identity not found');
    }

    return { message: 'SSO identity unlinked successfully' };
  }

  /**
   * Get user's linked SSO identities
   */
  async getUserIdentities(userId) {
    const identities = await UserIdentity.findAll({
      where: { userId },
      attributes: ['id', 'provider', 'providerEmail', 'lastLoginAt', 'createdAt']
    });

    return identities;
  }

  /**
   * Issue JWT token for user (used by SSO flow)
   */
  issueToken(user) {
    return this.signJWT({
      userId: user.id,
      username: user.username,
      email: user.email
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
          fullName: user.fullName,
          hasPassword: user.hasPassword !== false // Manual registration always has password
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
          fullName: user.fullName,
          hasPassword: user.hasPassword
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
        attributes: ['id', 'username', 'email', 'fullName', 'isActive', 'hasPassword']
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        hasPassword: user.hasPassword
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set password for SSO users who don't have one
   */
  async setPassword(userId, newPassword) {
    try {
      const user = await User.findByPk(userId);

      if (!user || !user.isActive) {
        throw new Error('User not found');
      }

      if (user.hasPassword) {
        throw new Error('Anda sudah memiliki kata sandi. Gunakan fitur ubah kata sandi.');
      }

      // Update password and set hasPassword to true
      await user.update({ 
        password: newPassword,
        hasPassword: true 
      });

      return { message: 'Kata sandi berhasil diatur' };
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
        fullName: user.fullName,
        hasPassword: user.hasPassword
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
