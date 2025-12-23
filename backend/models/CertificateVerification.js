const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CertificateVerification = sequelize.define('CertificateVerification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  token: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true
  },
  templateUuid: {
    type: DataTypes.UUID,
    allowNull: true
  },
  templateName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  eventUuid: {
    type: DataTypes.UUID,
    allowNull: true
  },
  eventTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  participantUuid: {
    type: DataTypes.UUID,
    allowNull: true
  },
  fields: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'revoked', 'deleted'),
    allowNull: false,
    defaultValue: 'approved'
  },
  issuedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastDownloadedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isRevoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  revokedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'certificate_verifications',
  indexes: [
    {
      unique: true,
      fields: ['templateUuid', 'participantUuid']
    }
  ],
  timestamps: true
});

module.exports = CertificateVerification;
