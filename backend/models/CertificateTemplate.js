const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CertificateTemplate = sequelize.define('CertificateTemplate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [3, 100]
    }
  },
  design: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Konva.js design configuration including elements, positions, styling'
  },
  backgroundImage: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL or path to background image'
  },
  width: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 842,
    comment: 'Template width in pixels (A4 landscape default)'
  },
  height: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 595,
    comment: 'Template height in pixels (A4 landscape default)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  eventId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id'
    }
  }
}, {
  tableName: 'certificate_templates',
  timestamps: true
});

module.exports = CertificateTemplate;
