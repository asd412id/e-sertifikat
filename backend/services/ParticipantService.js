const { Participant, Event } = require('../models');
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const fs = require('fs').promises;
const path = require('path');

class ParticipantService {
  async getEventByUuid(eventUuid, userId) {
    const event = await Event.findOne({
      where: { uuid: eventUuid, userId, isActive: true }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return event;
  }

  async addParticipant(eventId, participantData, userId) {
    try {
      // Verify event ownership
      const event = await this.getEventByUuid(eventId, userId);

      // Validate participant data against event fields
      this.validateParticipantData(participantData, event.participantFields);

      const participant = await Participant.create({
        eventId: event.id,
        data: participantData
      });

      return participant;
    } catch (error) {
      throw error;
    }
  }

  async getParticipantsByEvent(eventId, userId, page = 1, limit = 10, search = '') {
    try {
      // Verify event ownership
      const event = await this.getEventByUuid(eventId, userId);

      const offset = (page - 1) * limit;

      // Build search condition
      let whereCondition = { eventId: event.id };
      if (search) {
        // Create search conditions for all participant fields
        const searchConditions = [];
        for (const field of event.participantFields) {
          const condition = {};
          condition[`data.${field.name}`] = {
            [Op.iLike]: `%${search}%`
          };
          searchConditions.push(condition);
        }

        whereCondition = {
          eventId: event.id,
          [Op.or]: searchConditions
        };
      }

      const { count, rows } = await Participant.findAndCountAll({
        where: whereCondition,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return {
        participants: rows,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit
      };
    } catch (error) {
      throw error;
    }
  }

  async updateParticipant(participantId, participantData, userId) {
    try {
      const participant = await Participant.findOne({
        where: { uuid: participantId },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

      // Validate participant data against event fields
      this.validateParticipantData(participantData, participant.event.participantFields);

      await participant.update({ data: participantData });
      return participant;
    } catch (error) {
      throw error;
    }
  }

  async deleteParticipant(participantId, userId) {
    try {
      const participant = await Participant.findOne({
        where: { uuid: participantId },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

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

      await participant.destroy();
      return { message: 'Participant deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  async deleteAllParticipantsByEvent(eventId, userId) {
    try {
      const event = await this.getEventByUuid(eventId, userId);

      const participants = await Participant.findAll({
        where: { eventId: event.id }
      });

      for (const participant of participants) {
        if (participant.certificateUrl) {
          const certificatePath = participant.certificateUrl;
          if (certificatePath.startsWith('/uploads/')) {
            const fileName = certificatePath.replace('/uploads/', '');
            const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);
            try {
              await fs.unlink(filePath);
            } catch (error) {
              console.log(`Failed to delete certificate: ${filePath}`);
            }
          }
        }
      }

      const deletedCount = await Participant.destroy({
        where: { eventId: event.id }
      });

      return { deletedCount };
    } catch (error) {
      throw error;
    }
  }

  async importFromExcel(eventId, filePath, userId, mode = 'append') {
    try {
      // Verify event ownership
      const event = await this.getEventByUuid(eventId, userId);

      if (mode !== 'append' && mode !== 'replace') {
        throw new Error("Invalid import mode. Use 'append' or 'replace'");
      }

      if (mode === 'replace') {
        await this.deleteAllParticipantsByEvent(eventId, userId);
      }

      // Read Excel file
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      // Create a mapping from field labels to field names (case-insensitive)
      const fieldLabelToNameMap = {};
      event.participantFields.forEach(field => {
        fieldLabelToNameMap[field.label.toLowerCase().trim()] = field.name;
      });

      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        try {
          const rowData = jsonData[i];

          // Transform row data: map Excel column labels to field names
          const transformedData = {};
          Object.keys(rowData).forEach(label => {
            // Use case-insensitive matching
            const normalizedLabel = label.toLowerCase().trim();
            const fieldName = fieldLabelToNameMap[normalizedLabel] || label;
            transformedData[fieldName] = rowData[label];
          });

          // Validate participant data using field names
          this.validateParticipantData(transformedData, event.participantFields);

          await Participant.create({
            eventId: event.id,
            data: transformedData
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 2, // Excel row number (starting from 2 due to header)
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw error;
    }
  }

  validateParticipantData(data, fields) {
    console.log('Validating participant data:', data, 'against fields:', fields);
    for (const field of fields) {
      // Check if the field exists in the data using the field name
      const fieldValue = data[field.name];
      if (field.required && (!fieldValue || fieldValue.toString().trim() === '')) {
        throw new Error(`Field '${field.label}' is required`);
      }
    }
  }

  async getParticipantById(participantId, userId) {
    try {
      const participant = await Participant.findOne({
        where: { uuid: participantId },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

      return participant;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new ParticipantService();
