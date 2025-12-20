const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [3, 200]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  participantFields: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [
      { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
      { name: 'instansi', label: 'Instansi', type: 'text', required: false }
    ]
  },
  publicDownloadEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  publicDownloadSlug: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  publicDownloadIdentifierField: {
    type: DataTypes.STRING,
    allowNull: true
  },
  publicDownloadMatchMode: {
    type: DataTypes.ENUM('exact', 'fuzzy'),
    allowNull: false,
    defaultValue: 'exact'
  },
  publicDownloadSearchFields: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  publicDownloadTemplateId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'certificate_templates',
      key: 'id'
    }
  },
  publicDownloadResultFields: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'events',
  timestamps: true
});

module.exports = Event;
