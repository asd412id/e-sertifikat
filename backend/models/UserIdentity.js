const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserIdentity = sequelize.define('UserIdentity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  provider: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'SSO provider name (e.g., simpatik, google, etc.)'
  },
  providerId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Unique user ID from the SSO provider'
  },
  providerEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Email from SSO provider'
  },
  providerData: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional data from SSO provider (name, etc.)'
  },
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Latest access token (optional, for API calls)'
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Refresh token if provided'
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user_identities',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['provider', 'providerId'],
      name: 'unique_provider_identity'
    },
    {
      fields: ['userId'],
      name: 'idx_user_identities_user'
    }
  ]
});

module.exports = UserIdentity;
