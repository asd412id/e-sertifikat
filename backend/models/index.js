const sequelize = require('../config/database');
const User = require('./User');
const Event = require('./Event');
const Participant = require('./Participant');
const CertificateTemplate = require('./CertificateTemplate');
const CertificateVerification = require('./CertificateVerification');
const Asset = require('./Asset');
const UserIdentity = require('./UserIdentity');

// Define associations
User.hasMany(Event, { foreignKey: 'userId', as: 'events' });
Event.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Asset, { foreignKey: 'userId', as: 'assets' });
Asset.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Event.hasMany(Participant, { foreignKey: 'eventId', as: 'participants' });
Participant.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

Event.hasMany(CertificateTemplate, { foreignKey: 'eventId', as: 'certificateTemplates' });
CertificateTemplate.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

// SSO Identity associations
User.hasMany(UserIdentity, { foreignKey: 'userId', as: 'identities' });
UserIdentity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Asset,
  Event,
  Participant,
  CertificateTemplate,
  CertificateVerification,
  UserIdentity
};
