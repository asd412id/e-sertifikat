const EventService = require('../services/EventService');

class EventController {
  async createEvent(request, reply) {
    try {
      const { title, description, startDate, endDate, location, participantFields } = request.body;

      if (!title || !startDate || !endDate) {
        return reply.status(400).send({
          error: 'Title, start date, and end date are required'
        });
      }

      const event = await EventService.createEvent({
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        participantFields: participantFields || [
          { name: 'nama', label: 'Nama Lengkap', type: 'text', required: true },
          { name: 'instansi', label: 'Instansi', type: 'text', required: false }
        ]
      }, request.user.userId);

      reply.status(201).send({
        success: true,
        message: 'Event created successfully',
        data: { event }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async getEvents(request, reply) {
    try {
      const { page = 1, limit = 10 } = request.query;

      const result = await EventService.getEventsByUser(
        request.user.userId,
        parseInt(page),
        parseInt(limit)
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      reply.status(500).send({
        error: error.message
      });
    }
  }

  async getEventById(request, reply) {
    try {
      const { id } = request.params;

      const event = await EventService.getEventById(id, request.user.userId);

      reply.send({
        success: true,
        data: { event }
      });
    } catch (error) {
      reply.status(404).send({
        error: error.message
      });
    }
  }

  async updateEvent(request, reply) {
    try {
      const { id } = request.params;
      const updateData = request.body;

      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      const event = await EventService.updateEvent(id, updateData, request.user.userId);

      reply.send({
        success: true,
        message: 'Event updated successfully',
        data: { event }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async updatePublicDownloadSettings(request, reply) {
    try {
      const { id } = request.params;
      const settings = request.body;

      const event = await EventService.updatePublicDownloadSettings(
        id,
        settings,
        request.user.userId
      );

      reply.send({
        success: true,
        message: 'Public download settings updated successfully',
        data: {
          event,
          publicDownloadUrl: event.publicDownloadEnabled && event.publicDownloadSlug
            ? `/download/${event.publicDownloadSlug}`
            : null
        }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async deleteEvent(request, reply) {
    try {
      const { id } = request.params;

      const result = await EventService.deleteEvent(id, request.user.userId);

      reply.send({
        success: true,
        message: result.message
      });
    } catch (error) {
      if (error.message === 'Event not found') {
        reply.status(404).send({
          error: error.message
        });
      } else {
        reply.status(500).send({
          error: 'Failed to delete event and related data'
        });
      }
    }
  }

  async getEventParticipantFields(request, reply) {
    try {
      const { id } = request.params;

      const fields = await EventService.getEventParticipantFields(id, request.user.userId);

      reply.send({
        success: true,
        data: { fields }
      });
    } catch (error) {
      reply.status(404).send({
        error: error.message
      });
    }
  }
}

module.exports = new EventController();
