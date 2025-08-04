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

  async generateCertificate(request, reply) {
    try {
      const { templateId, participantId } = request.params;

      const result = await CertificateService.generateCertificate(
        parseInt(templateId),
        parseInt(participantId),
        request.user.userId
      );

      reply.send({
        success: true,
        message: 'Certificate generated successfully',
        data: result
      });
    } catch (error) {
      reply.status(400).send({
        error: error.message
      });
    }
  }

  async generateAllCertificates(request, reply) {
    try {
      const { templateId } = request.params;

      const result = await CertificateService.generateAllCertificates(
        parseInt(templateId),
        request.user.userId
      );

      reply.send({
        success: true,
        message: 'Certificates generation completed',
        data: result
      });
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

  async bulkDownloadCertificates(request, reply) {
    try {
      const { eventId } = request.params;
      // Note: We're not using participantIds from request.body anymore
      // Instead, we'll fetch all participants with generated certificates for this event

      console.log(`Bulk download request for event ${eventId}`);

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

      // Get all participants with generated certificates for this event
      const participants = await Participant.findAll({
        where: {
          eventId: eventId,
          certificateGenerated: true
        },
        order: [['id', 'ASC']]
      });

      if (participants.length === 0) {
        console.log('No participants with certificates found');
        return reply.status(404).send({
          error: 'No certificates found for this event'
        });
      }

      console.log(`Found ${participants.length} participants with certificates`);

      // Create a zip file containing all certificates
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level
      });

      // Collect the archive data in a buffer
      const chunks = [];

      archive.on('data', (chunk) => {
        chunks.push(chunk);
      });

      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!reply.sent) {
          reply.status(500).send({ error: 'Error creating zip file' });
        }
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Archive warning:', err);
        } else {
          console.error('Archive warning (critical):', err);
        }
      });

      let filesAdded = 0;

      // Add each certificate to the zip
      for (const participant of participants) {
        if (participant.certificateUrl) {
          const filename = participant.certificateUrl.split('/').pop();
          const filePath = path.join(process.env.UPLOAD_DIR || './uploads', filename);

          try {
            // Check if file exists before adding
            await fs.access(filePath);
            const stats = await fs.stat(filePath);

            if (stats.size > 0) {
              const displayName = participant.data && (participant.data.nama || participant.data.name) ?
                (participant.data.nama || participant.data.name).replace(/[^\w\s-]/g, '') : 'participant';
              archive.file(filePath, { name: `${displayName}_${filename}` });
              filesAdded++;
              console.log(`Added certificate for ${displayName}: ${filename}`);
            } else {
              console.log(`Certificate file is empty for participant ${participant.id}: ${filePath}`);
            }
          } catch (fileError) {
            console.log(`Certificate file not found for participant ${participant.id}: ${filePath}`);
            // Continue with other files even if one is missing
          }
        }
      }

      if (filesAdded === 0) {
        console.log('No valid certificate files found');
        archive.destroy();
        return reply.status(404).send({
          error: 'No certificate files found on server'
        });
      }

      console.log(`Added ${filesAdded} files to zip`);

      // Finalize the archive and wait for it to complete
      await new Promise((resolve, reject) => {
        archive.on('end', () => {
          console.log('Archive finalized successfully');
          resolve();
        });

        archive.on('error', reject);

        archive.finalize();
      });

      // Combine all chunks into a single buffer
      const zipBuffer = Buffer.concat(chunks);
      console.log(`Zip buffer size: ${zipBuffer.length} bytes`);

      // Set headers for zip download
      const zipFileName = `sertifikat_${event.title?.replace(/[^\w\s-]/g, '') || eventId}.zip`;
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${zipFileName}"`);
      reply.header('Content-Length', zipBuffer.length);
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      // Send the zip buffer
      reply.send(zipBuffer);
    } catch (error) {
      console.error('Bulk download error:', error);
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
