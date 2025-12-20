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

      const updateData = { ...eventData };

      // Normalize participantFields if provided
      if (Object.prototype.hasOwnProperty.call(updateData, 'participantFields')) {
        const fields = Array.isArray(updateData.participantFields) ? updateData.participantFields : [];
        if (!fields.length) {
          throw new Error('participantFields must contain at least 1 field');
        }

        const normalized = fields
          .map((f) => ({
            name: String(f?.name || '').trim(),
            label: String(f?.label || '').trim(),
            type: (f?.type === 'email' || f?.type === 'number') ? f.type : 'text',
            required: !!f?.required
          }))
          .filter((f) => f.name && f.label);

        if (!normalized.length) {
          throw new Error('participantFields must contain at least 1 valid field');
        }

        // Validate names
        const nameRe = /^[a-zA-Z0-9_]+$/;
        for (const f of normalized) {
          if (!nameRe.test(f.name)) {
            throw new Error(`Invalid participant field name: ${f.name}`);
          }
        }

        // Ensure unique names
        const seen = new Set();
        for (const f of normalized) {
          if (seen.has(f.name)) {
            throw new Error(`Duplicate participant field name: ${f.name}`);
          }
          seen.add(f.name);
        }

        updateData.participantFields = normalized;

        // Adjust dependent public download configs so portal doesn't break when fields are removed.
        const allowed = new Set(normalized.map((f) => f.name));

        // searchFields
        let nextSearchFields = Array.isArray(event.publicDownloadSearchFields)
          ? event.publicDownloadSearchFields
            .map((f) => ({
              name: String(f?.name || '').trim(),
              matchMode: (f?.matchMode === 'fuzzy' ? 'fuzzy' : 'exact'),
              required: f?.required !== false
            }))
            .filter((f) => f.name && allowed.has(f.name))
          : null;
        if (nextSearchFields && nextSearchFields.length === 0) nextSearchFields = null;

        // resultFields
        let nextResultFields = Array.isArray(event.publicDownloadResultFields)
          ? event.publicDownloadResultFields.filter((n) => typeof n === 'string' && allowed.has(n))
          : null;
        if (nextResultFields && nextResultFields.length === 0) nextResultFields = null;

        // identifierField
        let nextIdentifierField = event.publicDownloadIdentifierField;
        let nextMatchMode = event.publicDownloadMatchMode || 'exact';
        if (nextSearchFields?.length) {
          nextIdentifierField = nextSearchFields[0].name;
          nextMatchMode = nextSearchFields[0].matchMode || nextMatchMode;
        } else if (nextIdentifierField && !allowed.has(nextIdentifierField)) {
          // fallback to first available field
          nextIdentifierField = normalized[0]?.name || null;
          nextMatchMode = 'exact';
        }

        if (event.publicDownloadEnabled) {
          // If identifier becomes invalid, disable the portal to avoid broken public searches.
          if (!nextIdentifierField) {
            updateData.publicDownloadEnabled = false;
            updateData.publicDownloadIdentifierField = null;
            updateData.publicDownloadSearchFields = null;
            updateData.publicDownloadResultFields = null;
          } else {
            updateData.publicDownloadIdentifierField = nextIdentifierField;
            updateData.publicDownloadMatchMode = nextMatchMode;
            updateData.publicDownloadSearchFields = nextSearchFields;
            updateData.publicDownloadResultFields = nextResultFields;
          }
        } else {
          // Keep configs consistent even if portal currently disabled
          updateData.publicDownloadSearchFields = nextSearchFields;
          updateData.publicDownloadResultFields = nextResultFields;
        }
      }

      await event.update(updateData);
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
        resultFields,
        searchFields
      } = settings || {};

      let normalizedSearchFields = null;

      if (typeof enabled !== 'boolean') {
        throw new Error('enabled must be a boolean');
      }

      if (enabled) {
        const fields = Array.isArray(event.participantFields) ? event.participantFields : [];
        const allowedFieldNames = fields.map(f => f?.name).filter(Boolean);

        // Optional new-style search fields config
        if (Array.isArray(searchFields) && searchFields.length > 0) {
          normalizedSearchFields = searchFields
            .map((f) => ({
              name: String(f?.name || '').trim(),
              matchMode: (f?.matchMode === 'fuzzy' ? 'fuzzy' : 'exact'),
              required: f?.required !== false
            }))
            .filter((f) => f.name && allowedFieldNames.includes(f.name) && /^[a-zA-Z0-9_]+$/.test(f.name));

          if (!normalizedSearchFields.length) {
            throw new Error('Invalid searchFields');
          }

          // require at least 1 required field
          if (!normalizedSearchFields.some((f) => f.required)) {
            normalizedSearchFields[0].required = true;
          }

          // de-dup by name (keep first)
          const seen = new Set();
          normalizedSearchFields = normalizedSearchFields.filter((f) => {
            if (seen.has(f.name)) return false;
            seen.add(f.name);
            return true;
          });
        }

        // Backward compatible single field validation if searchFields not provided
        if (!normalizedSearchFields) {
          if (!identifierField || !allowedFieldNames.includes(identifierField) || !/^[a-zA-Z0-9_]+$/.test(identifierField)) {
            throw new Error('Invalid identifierField');
          }
          if (matchMode && !['exact', 'fuzzy'].includes(matchMode)) {
            throw new Error('Invalid matchMode');
          }
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
        publicDownloadIdentifierField: enabled
          ? (normalizedSearchFields?.[0]?.name || identifierField || event.publicDownloadIdentifierField)
          : null,
        publicDownloadMatchMode: enabled
          ? (normalizedSearchFields?.[0]?.matchMode || matchMode || 'exact')
          : event.publicDownloadMatchMode,
        publicDownloadSearchFields: enabled
          ? (normalizedSearchFields || null)
          : null,
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
