const { CertificateTemplate, Event, Participant, sequelize } = require('../models');
const puppeteerPDFService = require('./PuppeteerPDFService');
const fs = require('fs').promises;
const path = require('path');

class CertificateService {
  async createTemplate(templateData, userId) {
    try {
      // Verify event ownership
      const event = await Event.findOne({
        where: { id: templateData.eventId, userId, isActive: true }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      const template = await CertificateTemplate.create({
        ...templateData,
        eventId: templateData.eventId
      });

      return template;
    } catch (error) {
      throw error;
    }
  }

  async getTemplatesByEvent(eventId, userId, page = 1, limit = 10) {
    try {
      // Verify event ownership
      const event = await Event.findOne({
        where: { id: eventId, userId, isActive: true }
      });

      if (!event) {
        throw new Error('Event not found');
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await CertificateTemplate.findAndCountAll({
        where: { eventId, isActive: true },
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return {
        templates: rows,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page
      };
    } catch (error) {
      throw error;
    }
  }

  async getTemplateById(templateId, userId) {
    try {
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    } catch (error) {
      throw error;
    }
  }

  async updateTemplate(templateId, templateData, userId) {
    try {
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Check if we're updating the background image
      if (templateData.design && templateData.design.background &&
        template.design && template.design.background &&
        templateData.design.background !== template.design.background) {
        // Delete old background image file if it exists and is different from the new one
        const oldBackgroundPath = template.design.background;
        if (oldBackgroundPath.startsWith('/uploads/')) {
          const oldFileName = oldBackgroundPath.replace('/uploads/', '');
          const oldFilePath = path.join(process.env.UPLOAD_DIR || './uploads', oldFileName);
          try {
            await fs.unlink(oldFilePath);
          } catch (error) {
            // Ignore error if file doesn't exist
            console.log(`Failed to delete old background image: ${oldFilePath}`);
          }
        }
      }

      await template.update(templateData);
      return template;
    } catch (error) {
      throw error;
    }
  }

  async deleteTemplate(templateId, userId) {
    try {
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

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

      await template.update({ isActive: false });
      return { message: 'Template deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  async generateCertificate(templateId, participantId, userId) {
    try {
      // Get template
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Get participant
      const participant = await Participant.findOne({
        where: { id: participantId, eventId: template.eventId }
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

      // Delete old certificate file if it exists
      if (participant.certificateUrl) {
        const oldCertificatePath = participant.certificateUrl;
        if (oldCertificatePath.startsWith('/uploads/')) {
          const oldFileName = oldCertificatePath.replace('/uploads/', '');
          const oldFilePath = path.join(process.env.UPLOAD_DIR || './uploads', oldFileName);
          try {
            await fs.unlink(oldFilePath);
          } catch (error) {
            // Ignore error if file doesn't exist
            console.log(`Failed to delete old certificate: ${oldFilePath}`);
          }
        }
      }

      // Generate PDF
      const pdfBuffer = await this.createPDFFromTemplate(template, participant);

      // Save PDF file with participant name in filename
      const participantName = participant.data?.nama || participant.data?.name || 'participant';
      // Simplified filename sanitization to avoid regex issues
      const sanitizedName = participantName
        .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1A20-\u1AAF\u1B00-\u1B7F\u1B80-\u1BBF\u1BC0-\u1BFF\u1C00-\u1C4F\u1C50-\u1C7F\u1CD0-\u1CFF\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u20D0-\u20FF\u2100-\u214F\u2150-\u218F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2400-\u243F\u2440-\u245F\u2460-\u24FF\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u27C0-\u27EF\u27F0-\u27FF\u2800-\u28FF\u2900-\u297F\u2980-\u29FF\u2A00-\u2AFF\u2B00-\u2BFF\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2DE0-\u2DFF\u2E00-\u2E7F\u2E80-\u2EFF\u2F00-\u2FDF\u2FF0-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31A0-\u31BF\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA4D0-\uA4FF\uA500-\uA63F\uA640-\uA69F\uA6A0-\uA6FF\uA700-\uA71F\uA720-\uA7FF\uA800-\uA82F\uA830-\uA83F\uA840-\uA87F\uA880-\uA8DF\uA8E0-\uA8FF\uA900-\uA92F\uA930-\uA95F\uA960-\uA97F\uA980-\uA9DF\uA9E0-\uA9FF\uAA00-\uAA5F\uAA60-\uAA7F\uAA80-\uAADF\uAAE0-\uAAFF\uAB00-\uAB2F\uAB30-\uAB6F\uAB70-\uABBF\uABC0-\uABFF\uAC00-\uD7AF\uD7B0-\uD7FF\uF900-\uFAFF\uFE00-\uFE0F\uFE10-\uFE1F\uFE20-\uFE2F\uFE30-\uFE4F\uFE50-\uFE6F\uFE70-\uFEFF\uFF00-\uFFEF\s]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50); // Limit length to avoid filesystem issues
      const timestamp = Date.now();
      const fileName = `certificate_${sanitizedName}_${participantId}_${timestamp}.pdf`;
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);

      // Ensure the buffer is properly handled
      if (Buffer.isBuffer(pdfBuffer)) {
        await fs.writeFile(filePath, pdfBuffer);
      } else {
        // If it's not a buffer, convert it to buffer
        const buffer = Buffer.from(pdfBuffer);
        await fs.writeFile(filePath, buffer);
      }

      // Update participant record with retry mechanism to avoid 409 conflicts
      let updateAttempts = 0;
      const maxUpdateAttempts = 3;
      let updateSuccess = false;

      while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
        try {
          updateAttempts++;

          // Use a transaction to ensure data consistency
          await sequelize.transaction(async (t) => {
            const freshParticipant = await Participant.findOne({
              where: { id: participantId },
              transaction: t
            });

            if (!freshParticipant) {
              throw new Error('Participant not found during update');
            }

            await freshParticipant.update({
              certificateGenerated: true,
              certificateUrl: `/uploads/${fileName}`
            }, { transaction: t });
          });

          updateSuccess = true;
        } catch (updateError) {
          if (updateAttempts === maxUpdateAttempts) {
            console.error(`Failed to update participant after ${maxUpdateAttempts} attempts:`, updateError);
            throw new Error(`Failed to save certificate information: ${updateError.message}`);
          }

          // Wait before retrying with exponential backoff
          const waitTime = Math.pow(2, updateAttempts) * 100;
          console.log(`Update attempt ${updateAttempts} failed, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      return {
        fileName,
        filePath: `/uploads/${fileName}`,
        participant: participant.data
      };
    } catch (error) {
      console.error('Certificate generation failed:', error);
      throw error;
    }
  }

  async generateAllCertificates(templateId, userId) {
    try {
      // Get template and event info
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Get all participants for this event
      const participants = await Participant.findAll({
        where: { eventId: template.eventId },
        order: [['id', 'ASC']]
      });

      const totalParticipants = participants.length;
      console.log(`Starting certificate generation for template ${templateId} with ${totalParticipants} participants`);

      const results = {
        success: 0,
        failed: 0,
        total: totalParticipants,
        certificates: [],
        errors: []
      };

      // Process participants in parallel with controlled concurrency
      // Increased default concurrency and made it more adaptive
      const concurrencyLimit = Math.min(
        parseInt(process.env.CERTIFICATE_CONCURRENCY_LIMIT) || 10, // Increased default to 10
        participants.length || 1
      );

      console.log(`Using concurrency limit: ${concurrencyLimit}`);

      // Create all promises first for better memory management
      const allPromises = participants.map(async (participant) => {
        try {
          // Add a small delay between requests to reduce server load
          const delay = Math.random() * 100; // Random delay between 0-100ms
          await new Promise(resolve => setTimeout(resolve, delay));

          const result = await this.generateCertificate(templateId, participant.id, userId);
          return {
            success: true,
            participantId: participant.id,
            participantData: participant.data,
            certificateUrl: result.filePath
          };
        } catch (error) {
          // Log detailed error for debugging
          console.error(`Error generating certificate for participant ${participant.id}:`, {
            error: error.message,
            stack: error.stack,
            participantId: participant.id
          });

          return {
            success: false,
            participantId: participant.id,
            error: error.message
          };
        }
      });

      // Process all promises in batches to avoid memory issues
      const batches = [];
      for (let i = 0; i < allPromises.length; i += concurrencyLimit) {
        batches.push(allPromises.slice(i, i + concurrencyLimit));
      }

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} participants`);

        // Wait for all certificates in this batch to complete
        const batchResults = await Promise.allSettled(batch);

        // Process results
        for (const batchResult of batchResults) {
          if (batchResult.status === 'fulfilled' && batchResult.value.success) {
            results.success++;
            results.certificates.push({
              participantId: batchResult.value.participantId,
              participantData: batchResult.value.participantData,
              certificateUrl: batchResult.value.certificateUrl
            });
            console.log(`Generated certificate for participant ${batchResult.value.participantId} (${results.success}/${totalParticipants})`);
          } else {
            results.failed++;
            const error = batchResult.status === 'fulfilled' ? batchResult.value.error : batchResult.reason.message;
            results.errors.push({
              participantId: batchResult.value?.participantId || 'unknown',
              error: error
            });
            console.error(`Failed to generate certificate:`, error);
          }
        }
      }

      console.log(`Certificate generation completed. Success: ${results.success}, Failed: ${results.failed}`);
      return results;
    } catch (error) {
      console.error('Certificate generation failed:', error);
      throw error;
    }
  }

  async createPDFFromTemplate(template, participant) {
    try {
      // Use Puppeteer for better font support
      return await puppeteerPDFService.createPDFFromTemplate(template, participant);
    } catch (error) {
      console.log('Puppeteer failed:', error);
    }
  }

  replacePlaceholders(text, participantData) {
    let result = text;

    // Replace placeholders like {nama}, {instansi}, etc.
    for (const [key, value] of Object.entries(participantData)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value || '');
    }

    return result;
  }
}

module.exports = new CertificateService();
