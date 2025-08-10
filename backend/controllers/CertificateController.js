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
      // Fetch template (ownership validated inside service)
      const template = await CertificateService.getTemplateById(parseInt(templateId), request.user.userId);

      // Fetch participant directly (must belong to the same event)
      const participant = await Participant.findOne({
        where: { id: parseInt(participantId), eventId: template.eventId }
      });

      if (!participant) {
        return reply.status(404).send({ error: 'Participant not found' });
      }

      // If previously a certificate file was generated & stored, remove it now (requirement #3)
      if (participant.certificateUrl) {
        const oldPath = participant.certificateUrl;
        if (oldPath.startsWith('/uploads/')) {
          const oldFileName = oldPath.replace('/uploads/', '');
          const oldFilePath = path.join(process.env.UPLOAD_DIR || './uploads', oldFileName);
          try {
            await fs.unlink(oldFilePath);
            console.log('Successfully cleaned up old certificate file:', oldFilePath);
          } catch (err) {
            // ignore if doesn't exist
            console.log('Cleanup old certificate file failed (ignored):', oldFilePath, '-', err.message);
          }
        }
        // Reset participant stored status so UI no longer relies on it
        try {
          await participant.update({ certificateGenerated: false, certificateUrl: null });
          console.log('Successfully reset participant certificate flags');
        } catch (e) {
          console.log('Failed to reset participant certificate flags (ignored):', e.message);
        }
      }

      // Generate PDF on-the-fly (no persistence) using unified method
      const PuppeteerPDFService = require('../services/PuppeteerPDFService');
      const pdfBuffer = await PuppeteerPDFService.createPDF(template, participant);

      if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        return reply.status(500).send({ error: 'Failed to generate PDF' });
      }

      // Build a transient filename (not saved)
      const participantName = participant.data?.nama || participant.data?.name || 'participant';
      const sanitizedName = participantName
        .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u1380-\u139F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u177F\u1780-\u17FF\u1800-\u18AF\u1900-\u194F\u1950-\u197F\u1980-\u19DF\u19E0-\u19FF\u1A00-\u1A1F\u1A20-\u1AAF\u1B00-\u1B7F\u1B80-\u1BBF\u1BC0-\u1BFF\u1C00-\u1C4F\u1C50-\u1C7F\u1CD0-\u1CFF\u1D00-\u1D7F\u1D80-\u1DBF\u1DC0-\u1DFF\u1E00-\u1EFF\u1F00-\u1FFF\u2000-\u206F\u2070-\u209F\u20A0-\u20CF\u20D0-\u20FF\u2100-\u214F\u2150-\u218F\u2190-\u21FF\u2200-\u22FF\u2300-\u23FF\u2400-\u243F\u2440-\u245F\u2460-\u24FF\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u27C0-\u27EF\u27F0-\u27FF\u2800-\u28FF\u2900-\u297F\u2980-\u29FF\u2A00-\u2AFF\u2B00-\u2BFF\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2DE0-\u2DFF\u2E00-\u2E7F\u2E80-\u2EFF\u2F00-\u2FDF\u2FF0-\u2FFF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3130-\u318F\u3190-\u319F\u31A0-\u31BF\u31C0-\u31EF\u31F0-\u31FF\u3200-\u32FF\u3300-\u33FF\u3400-\u4DBF\u4DC0-\u4DFF\u4E00-\u9FFF\uA000-\uA48F\uA490-\uA4CF\uA4D0-\uA4FF\uA500-\uA63F\uA640-\uA69F\uA6A0-\uA6FF\uA700-\uA71F\uA720-\uA7FF\uA800-\uA82F\uA830-\uA83F\uA840-\uA87F\uA880-\uA8DF\uA8E0-\uA8FF\uA900-\uA92F\uA930-\uA95F\uA960-\uA97F\uA980-\uA9DF\uA9E0-\uA9FF\uAA00-\uAA5F\uAA60-\uAA7F\uAA80-\uAADF\uAAE0-\uAAFF\uAB00-\uAB2F\uAB30-\uAB6F\uAB70-\uABBF\uABC0-\uABFF\uAC00-\uD7AF\uD7B0-\uD7FF\uF900-\uFAFF\uFE00-\uFE0F\uFE10-\uFE1F\uFE20-\uFE2F\uFE30-\uFE4F\uFE50-\uFE6F\uFE70-\uFEFF\uFF00-\uFFEF\s]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      const filename = `certificate_${sanitizedName}_${participantId}_${Date.now()}.pdf`;

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', pdfBuffer.length);
      reply.send(pdfBuffer);
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

  async downloadIndividualCertificatePDF(request, reply) {
    try {
      const { templateId, participantId } = request.params;

      console.log(`Individual PDF download request for participant ${participantId} with template ${templateId}`);

      // Get template and verify ownership
      const template = await CertificateService.getTemplateById(parseInt(templateId), request.user.userId);
      if (!template) {
        console.log('Template not found');
        return reply.status(404).send({
          error: 'Template not found'
        });
      }

      // Get the participant and verify they belong to the template's event
      const participant = await Participant.findOne({
        where: {
          id: participantId,
          eventId: template.eventId
        }
      });

      if (!participant) {
        console.log('Participant not found or not part of this event');
        return reply.status(404).send({
          error: 'Participant not found or not part of this event'
        });
      }

      console.log(`Generating PDF for participant ${participantId}`);

      // Use unified single/bulk path
      const PuppeteerPDFService = require('../services/PuppeteerPDFService');
      const pdfBuffer = await PuppeteerPDFService.createPDF(template, participant);

      // Set headers for PDF download
      const participantName = participant.data?.name || participant.data?.nama || 'participant';
      const sanitizedName = participantName.replace(/[^\w\s-]/g, '_');
      const pdfFileName = `sertifikat_${sanitizedName}_${participantId}.pdf`;
      
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${pdfFileName}"`);
      reply.header('Content-Length', pdfBuffer.length);
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      console.log(`Sending individual PDF file: ${pdfFileName} (${pdfBuffer.length} bytes)`);

      // Send the PDF buffer
      reply.send(pdfBuffer);
    } catch (error) {
      console.error('Individual PDF download error:', error);
      if (!reply.sent) {
        reply.status(500).send({
          error: error.message
        });
      }
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

      // Use unified method for both bulk and single
      const PuppeteerPDFService = require('../services/PuppeteerPDFService');
      const pdfBuffer = await PuppeteerPDFService.createPDF(template, participants);

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
