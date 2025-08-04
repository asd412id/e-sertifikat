const { Event, Participant, CertificateTemplate } = require('../models');
const fs = require('fs').promises;
const path = require('path');

class EventService {
  async createEvent(eventData, userId) {
    try {
      const event = await Event.create({
        ...eventData,
        userId
      });
      return event;
    } catch (error) {
      throw error;
    }
  }

  async getEventsByUser(userId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;

      const { count, rows } = await Event.findAndCountAll({
        where: { userId, isActive: true },
        include: [
          {
            model: Participant,
            as: 'participants',
            attributes: ['id']
          },
          {
            model: CertificateTemplate,
            as: 'certificateTemplates',
            attributes: ['id', 'name']
          }
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        distinct: true
      });

      return {
        events: rows.map(event => ({
          ...event.toJSON(),
          participantCount: event.participants.length,
          templateCount: event.certificateTemplates.length
        })),
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page
      };
    } catch (error) {
      throw error;
    }
  }


  async updateEvent(eventId, eventData, userId) {
    try {
      const event = await Event.findOne({
        where: { id: eventId, userId, isActive: true }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      await event.update(eventData);
      return event;
    } catch (error) {
      throw error;
    }
  }

  async deleteEvent(eventId, userId) {
    try {
      const event = await Event.findOne({
        where: { id: eventId, userId, isActive: true },
        include: [
          {
            model: CertificateTemplate,
            as: 'certificateTemplates'
          },
          {
            model: Participant,
            as: 'participants'
          }
        ]
      });

      if (!event) {
        throw new Error('Event not found');
      }

      // Delete related certificate templates and their background images
      for (const template of event.certificateTemplates) {
        // Delete background image file if it exists
        if (template.design && template.design.background) {
          const backgroundPath = template.design.background;
          if (backgroundPath.startsWith('/uploads/')) {
            const fileName = backgroundPath.replace('/uploads/', '');
            const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);
            try {
              await fs.unlink(filePath);
            } catch (error) {
              // Ignore error if file doesn't exist
              console.log(`Failed to delete background image: ${filePath}`);
            }
          }
        }
        // Delete template
        await template.destroy();
      }

      // Delete related participant certificates
      for (const participant of event.participants) {
        // Delete certificate file if it exists
        if (participant.certificateUrl) {
          const certificatePath = participant.certificateUrl;
          if (certificatePath.startsWith('/uploads/')) {
            const fileName = certificatePath.replace('/uploads/', '');
            const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);
            try {
              await fs.unlink(filePath);
            } catch (error) {
              // Ignore error if file doesn't exist
              console.log(`Failed to delete certificate: ${filePath}`);
            }
          }
        }
        // Delete participant
        await participant.destroy();
      }

      // Delete the event
      await event.destroy();
      return { message: 'Event and all related data deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  async getEventParticipantFields(eventId, userId) {
    try {
      const event = await Event.findOne({
        where: { id: eventId, userId, isActive: true },
        attributes: ['participantFields']
      });

      if (!event) {
        throw new Error('Event not found');
      }

      return event.participantFields;
    } catch (error) {
      throw error;
    }
  }

  async getEventById(eventId, userId) {
    try {
      const event = await Event.findOne({
        where: { id: eventId, userId, isActive: true }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      return event;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EventService();
