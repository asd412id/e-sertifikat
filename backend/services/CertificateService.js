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

  async getTemplateByPublicId(templateId) {
    try {
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true }
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

      // Generate PDF buffer only (no persistence)
      const pdfBuffer = await this.createPDF(template, participant);
      return { pdfBuffer, participant: participant.data };
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
            // No persisted URL now; downstream callers should use on-demand generation
            certificateUrl: null
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

  async createPDF(template, participant) {
    try {
      // Use Puppeteer for better font support
      return await puppeteerPDFService.createPDF(template, participant);
    } catch (error) {
      console.error('Puppeteer failed:', error);
      throw error; // propagate to controller
    }
  }

  // replacePlaceholders method is now handled in PuppeteerPDFService
  // This method is kept for backward compatibility but delegates to the main service
  replacePlaceholders(text, participantData) {
    return puppeteerPDFService.replacePlaceholders(text, participantData);
  }
}

module.exports = new CertificateService();
