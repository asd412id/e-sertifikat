const CertificateService = require('../services/CertificateService');
const { Event, Participant } = require('../models');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');

class CertificateController {

  async createTemplate(request, reply) {
    try {
      const templateData = request.body;

      if (!templateData.name || !templateData.eventId) {
        return reply.status(400).send({
          error: 'Template name and event ID are required'
        });
      }

      const template = await CertificateService.createTemplate(templateData, request.user.userId);

      reply.status(201).send({
        success: true,
        message: 'Certificate template created successfully',
        data: { template }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async getTemplates(request, reply) {
    try {
      const { eventId } = request.params;
      const { page = 1, limit = 10 } = request.query;

      const result = await CertificateService.getTemplatesByEvent(
        parseInt(eventId),
        request.user.userId,
        parseInt(page),
        parseInt(limit)
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

  async getTemplateById(request, reply) {
    try {
      const { id } = request.params;

      const template = await CertificateService.getTemplateById(
        parseInt(id),
        request.user.userId
      );

      reply.send({
        success: true,
        data: { template }
      });
    } catch (error) {
      reply.status(404).send({
        error: error.message
      });
    }
  }

  async updateTemplate(request, reply) {
    try {
      const { id } = request.params;
      const templateData = request.body;

      const template = await CertificateService.updateTemplate(
        parseInt(id),
        templateData,
        request.user.userId
      );

      reply.send({
        success: true,
        message: 'Template updated successfully',
        data: { template }
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async deleteTemplate(request, reply) {
    try {
      const { id } = request.params;

      const result = await CertificateService.deleteTemplate(
        parseInt(id),
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

  async generateAndDownloadCertificate(request, reply) {
    try {
      const { templateId, participantId } = request.params;

      // Generate the certificate first
      const result = await CertificateService.generateCertificate(
        parseInt(templateId),
        parseInt(participantId),
        request.user.userId
      );

      if (!result.certificate || !result.certificate.certificateUrl) {
        return reply.status(404).send({
          error: 'Certificate generation failed'
        });
      }

      // Extract filename from URL
      const filename = result.certificate.certificateUrl.split('/').pop();
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return reply.status(404).send({
          error: 'Certificate file not found'
        });
      }

      // Read the file and send it directly
      const fileBuffer = await fs.readFile(filePath);

      // Set headers for PDF download
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', fileBuffer.length);

      reply.send(fileBuffer);
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async downloadCertificate(request, reply) {
    try {
      const { filename } = request.params;
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return reply.status(404).send({
          error: 'Certificate file not found'
        });
      }

      // Read the file and send it directly
      const fileBuffer = await fs.readFile(filePath);

      // Set headers for PDF download
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', fileBuffer.length);

      reply.send(fileBuffer);
    } catch (error) {
      reply.status(500).send({
        error: error.message
      });
    }
  }

  async bulkDownloadCertificatesPDF(request, reply) {
    try {
      const { eventId, templateId } = request.params;

      console.log(`Bulk PDF download request for event ${eventId} with template ${templateId}`);

      // Get event and verify ownership
      const event = await Event.findOne({
        where: { id: eventId, userId: request.user.userId, isActive: true }
      });

      if (!event) {
        console.log('Event not found');
        return reply.status(404).send({
          error: 'Event not found'
        });
      }

      // Get template and verify ownership
      const template = await CertificateService.getTemplateById(parseInt(templateId), request.user.userId);
      if (!template) {
        console.log('Template not found');
        return reply.status(404).send({
          error: 'Template not found'
        });
      }

      // Get all participants for this event
      const participants = await Participant.findAll({
        where: {
          eventId: eventId
        },
        order: [['id', 'ASC']]
      });

      if (participants.length === 0) {
        console.log('No participants found');
        return reply.status(404).send({
          error: 'No participants found for this event'
        });
      }

      console.log(`Found ${participants.length} participants for bulk PDF generation`);

      // Use PuppeteerPDFService to generate bulk PDF
      const PuppeteerPDFService = require('../services/PuppeteerPDFService');
      const pdfBuffer = await PuppeteerPDFService.createBulkPDFFromTemplate(template, participants);

      // Set headers for PDF download
      const pdfFileName = `sertifikat_${event.title?.replace(/[^\w\s-]/g, '') || eventId}.pdf`;
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${pdfFileName}"`);
      reply.header('Content-Length', pdfBuffer.length);
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      console.log(`Sending bulk PDF file: ${pdfFileName} (${pdfBuffer.length} bytes)`);

      // Send the PDF buffer
      reply.send(pdfBuffer);
    } catch (error) {
      console.error('Bulk PDF download error:', error);
      if (!reply.sent) {
        reply.status(500).send({
          error: error.message
        });
      }
    }
  }

  async uploadBackgroundImage(request, reply) {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded'
        });
      }

      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Only JPEG and PNG images are supported'
        });
      }

      // Save uploaded file
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const fileName = `bg_${Date.now()}_${data.filename}`;
      const filePath = path.join(uploadDir, fileName);

      await fs.writeFile(filePath, await data.toBuffer());

      reply.send({
        success: true,
        message: 'Background image uploaded successfully',
        data: {
          filename: fileName,
          url: `/uploads/${fileName}`
        }
      });
    } catch (error) {
      reply.status(500).send({
        error: error.message
      });
    }
  }
}

module.exports = new CertificateController();
