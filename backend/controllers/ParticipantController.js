const ParticipantService = require('../services/ParticipantService');
const path = require('path');
const fs = require('fs').promises;
const { buildUniqueFileName } = require('../utils/fileNaming');

class ParticipantController {
  async addParticipant(request, reply) {
    try {
      const { eventId } = request.params;
      const participantData = request.body;

      const participant = await ParticipantService.addParticipant(
        eventId,
        participantData,
        request.user.userId
      );

      reply.status(201).send({
        success: true,
        message: 'Participant added successfully',
        data: { participant }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async deleteAllParticipants(request, reply) {
    try {
      const { eventId } = request.params;

      const result = await ParticipantService.deleteAllParticipantsByEvent(
        eventId,
        request.user.userId
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async getParticipants(request, reply) {
    try {
      const { eventId } = request.params;
      const { page = 1, limit = 10, search = '' } = request.query;

      const result = await ParticipantService.getParticipantsByEvent(
        eventId,
        request.user.userId,
        parseInt(page),
        parseInt(limit),
        search
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async getParticipantById(request, reply) {
    try {
      const { id } = request.params;

      const participant = await ParticipantService.getParticipantById(
        id,
        request.user.userId
      );

      reply.send({
        success: true,
        data: { participant }
      });
    } catch (error) {
      reply.status(404).send({
        error: error.message
      });
    }
  }

  async updateParticipant(request, reply) {
    try {
      const { id } = request.params;
      const participantData = request.body;

      const participant = await ParticipantService.updateParticipant(
        id,
        participantData,
        request.user.userId
      );

      reply.send({
        success: true,
        message: 'Participant updated successfully',
        data: { participant }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async deleteParticipant(request, reply) {
    try {
      const { id } = request.params;

      const result = await ParticipantService.deleteParticipant(
        id,
        request.user.userId
      );

      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      reply.status(404).send({
        error: error.message
      });
    }
  }

  async exportParticipants(request, reply) {
    try {
      const { eventId } = request.params;

      // Get all participants for this event
      const result = await ParticipantService.getParticipantsByEvent(
        eventId,
        request.user.userId,
        1,
        10000 // Get all participants
      );

      // Get event details for field information
      const eventService = require('../services/EventService');
      const eventResult = await eventService.getEventById(
        eventId,
        request.user.userId
      );

      // Get participant fields
      const fields = await eventService.getEventParticipantFields(
        eventId,
        request.user.userId
      ) || [];

      const participants = result.participants;

      // Prepare data for export
      const exportData = participants.map((participant, index) => {
        const row = { 'No': index + 1 };

        fields.forEach(field => {
          row[field.label] = participant.data?.[field.name] || '';
        });

        return row;
      });

      reply.send({
        success: true,
        data: {
          participants: exportData,
          fields: fields.map(f => f.label),
          eventName: eventResult.title
        }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async importParticipants(request, reply) {
    try {
      const { eventId } = request.params;
      const { mode = 'append' } = request.query;
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded'
        });
      }

      // Check file type
      if (!data.filename.endsWith('.xlsx') && !data.filename.endsWith('.xls')) {
        return reply.status(400).send({
          error: 'Only Excel files (.xlsx, .xls) are supported'
        });
      }

      // Save uploaded file temporarily
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const tempFileName = buildUniqueFileName({ prefix: 'temp', originalName: data.filename });
      const tempFilePath = path.join(uploadDir, tempFileName);

      await fs.writeFile(tempFilePath, await data.toBuffer());

      // Import participants
      const result = await ParticipantService.importFromExcel(
        eventId,
        tempFilePath,
        request.user.userId,
        mode
      );

      // Clean up temp file
      await fs.unlink(tempFilePath);

      reply.send({
        success: true,
        message: 'Import completed',
        data: result
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }
}

module.exports = new ParticipantController();
