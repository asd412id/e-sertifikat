const sequelize = require('../config/database');
const User = require('./User');
const Event = require('./Event');
const Participant = require('./Participant');
const CertificateTemplate = require('./CertificateTemplate');

// Define associations
User.hasMany(Event, { foreignKey: 'userId', as: 'events' });
Event.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Event.hasMany(Participant, { foreignKey: 'eventId', as: 'participants' });
Participant.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

Event.hasMany(CertificateTemplate, { foreignKey: 'eventId', as: 'certificateTemplates' });
CertificateTemplate.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

module.exports = {
  sequelize,
  User,
  Event,
  Participant,
  CertificateTemplate
};
