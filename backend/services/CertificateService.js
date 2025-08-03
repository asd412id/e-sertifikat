const { CertificateTemplate, Event, Participant } = require('../models');
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

      // Save PDF file
      const fileName = `certificate_${participantId}_${Date.now()}.pdf`;
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', fileName);

      // Ensure the buffer is properly handled
      if (Buffer.isBuffer(pdfBuffer)) {
        await fs.writeFile(filePath, pdfBuffer);
      } else {
        // If it's not a buffer, convert it to buffer
        const buffer = Buffer.from(pdfBuffer);
        await fs.writeFile(filePath, buffer);
      }

      // Update participant record
      await participant.update({
        certificateGenerated: true,
        certificateUrl: `/uploads/${fileName}`
      });

      return {
        fileName,
        filePath: `/uploads/${fileName}`,
        participant: participant.data
      };
    } catch (error) {
      throw error;
    }
  }

  async generateAllCertificates(templateId, userId) {
    try {
      // Get template
      const template = await CertificateTemplate.findOne({
        where: { id: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true },
          include: [{
            model: Participant,
            as: 'participants'
          }]
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      const results = {
        success: 0,
        failed: 0,
        certificates: [],
        errors: []
      };

      // Generate certificate for each participant
      for (const participant of template.event.participants) {
        try {
          const result = await this.generateCertificate(templateId, participant.id, userId);
          results.success++;
          results.certificates.push({
            participantId: participant.id,
            participantData: participant.data,
            certificateUrl: result.filePath
          });
        } catch (error) {
          results.failed++;
          results.errors.push({
            participantId: participant.id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
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
