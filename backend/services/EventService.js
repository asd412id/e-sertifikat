const { Event, Participant, CertificateTemplate } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

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

  async updatePublicDownloadSettings(eventId, settings, userId) {
    try {
      const event = await Event.findOne({
        where: { id: eventId, userId, isActive: true }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      const {
        enabled,
        identifierField,
        matchMode,
        templateId,
        regenerateSlug,
        slug: manualSlug,
        resultFields
      } = settings || {};

      if (typeof enabled !== 'boolean') {
        throw new Error('enabled must be a boolean');
      }

      if (enabled) {
        const fields = Array.isArray(event.participantFields) ? event.participantFields : [];
        const allowedFieldNames = fields.map(f => f?.name).filter(Boolean);

        if (!identifierField || !allowedFieldNames.includes(identifierField) || !/^[a-zA-Z0-9_]+$/.test(identifierField)) {
          throw new Error('Invalid identifierField');
        }

        if (matchMode && !['exact', 'fuzzy'].includes(matchMode)) {
          throw new Error('Invalid matchMode');
        }

        if (!templateId || Number.isNaN(parseInt(templateId))) {
          throw new Error('templateId is required');
        }

        const template = await CertificateTemplate.findOne({
          where: { id: parseInt(templateId), eventId: event.id, isActive: true }
        });

        if (!template) {
          throw new Error('Template not found');
        }
      }

      let slug = event.publicDownloadSlug;
      if (enabled && typeof manualSlug === 'string' && manualSlug.trim() && !regenerateSlug) {
        const candidate = manualSlug.trim().toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) {
          throw new Error('Invalid slug format');
        }
        if (candidate.length < 3 || candidate.length > 60) {
          throw new Error('Invalid slug length');
        }

        const existing = await Event.findOne({ where: { publicDownloadSlug: candidate } });
        if (existing && existing.id !== event.id) {
          throw new Error('Slug already in use');
        }
        slug = candidate;
      } else if (enabled && (!slug || regenerateSlug)) {
        const base = String(event.title || 'event')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 40) || 'event';

        for (let i = 0; i < 10; i++) {
          const suffix = crypto.randomBytes(3).toString('hex');
          const candidate = `${base}-${suffix}`;
          const existing = await Event.findOne({ where: { publicDownloadSlug: candidate } });
          if (!existing) {
            slug = candidate;
            break;
          }
        }

        if (!slug) {
          throw new Error('Failed to generate unique slug');
        }
      }

      await event.update({
        publicDownloadEnabled: enabled,
        publicDownloadIdentifierField: enabled ? identifierField : null,
        publicDownloadMatchMode: enabled ? (matchMode || 'exact') : event.publicDownloadMatchMode,
        publicDownloadTemplateId: enabled ? parseInt(templateId) : null,
        publicDownloadSlug: enabled ? slug : event.publicDownloadSlug,
        publicDownloadResultFields: enabled
          ? (Array.isArray(resultFields) ? resultFields : null)
          : null
      });

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
