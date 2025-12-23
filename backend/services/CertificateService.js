const { CertificateTemplate, Event, Participant, sequelize } = require('../models');
const puppeteerPDFService = require('./PuppeteerPDFService');
const fs = require('fs').promises;
const path = require('path');
const { buildUniqueFileName } = require('../utils/fileNaming');

class CertificateService {
  async getEventByUuid(eventUuid, userId) {
    const event = await Event.findOne({
      where: { uuid: eventUuid, userId, isActive: true }
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return event;
  }

  async createTemplate(templateData, userId) {
    try {
      // Verify event ownership
      const event = await this.getEventByUuid(templateData.eventId, userId);

      if (!event) {
        throw new Error('Event not found');
      }

      const template = await CertificateTemplate.create({
        ...templateData,
        eventId: event.id
      });

      return template;
    } catch (error) {
      throw error;
    }
  }

  async getTemplatesByEvent(eventId, userId, page = 1, limit = 10) {
    try {
      // Verify event ownership
      const event = await this.getEventByUuid(eventId, userId);

      if (!event) {
        throw new Error('Event not found');
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await CertificateTemplate.findAndCountAll({
        where: { eventId: event.id, isActive: true },
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
        where: { uuid: templateId, isActive: true },
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
        where: { uuid: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      // Prevent callers from overriding relational / immutable fields.
      const updatePayload = { ...templateData };
      delete updatePayload.eventId;
      delete updatePayload.id;
      delete updatePayload.uuid;

      const collectUploadAssetsFromDesign = (design) => {
        const assets = new Set();
        if (!design || typeof design !== 'object') return assets;

        const add = (p) => {
          if (typeof p === 'string' && p.startsWith('/uploads/')) assets.add(p);
        };

        const pages = (design.pages && Array.isArray(design.pages))
          ? design.pages
          : [{ background: design.background, objects: Array.isArray(design.objects) ? design.objects : [] }];

        for (const page of pages) {
          if (!page) continue;
          add(page.background);
          const objects = Array.isArray(page.objects) ? page.objects : [];
          for (const obj of objects) {
            if (!obj) continue;
            if (obj.type === 'image') add(obj.src);
            if (obj.type === 'qrcode') add(obj.logoSrc);
          }
        }

        return assets;
      };

      const oldDesign = template.design || {};
      const newDesign = (Object.prototype.hasOwnProperty.call(updatePayload, 'design')
        ? (updatePayload.design || {})
        : oldDesign);

      await template.update(updatePayload);

      return template;
    } catch (error) {
      throw error;
    }
  }

  async deleteTemplate(templateId, userId) {
    try {
      const template = await CertificateTemplate.findOne({
        where: { uuid: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      if (template.event && template.event.publicDownloadTemplateId === template.id) {
        await template.event.update({
          publicDownloadEnabled: false,
          publicDownloadIdentifierField: null,
          publicDownloadSearchFields: null,
          publicDownloadTemplateId: null,
          publicDownloadResultFields: null
        });
      }

      await template.destroy();
      return { message: 'Template deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  async copyTemplate(templateId, userId, name, targetEventId) {
    try {
      const template = await CertificateTemplate.findOne({
        where: { uuid: templateId, isActive: true },
        include: [{
          model: Event,
          as: 'event',
          where: { userId, isActive: true }
        }]
      });

      if (!template) {
        throw new Error('Template not found');
      }

      const nextNameRaw = (typeof name === 'string' && name.trim())
        ? name.trim()
        : `${template.name} (Copy)`;

      const nextName = nextNameRaw.length > 100
        ? nextNameRaw.substring(0, 100)
        : nextNameRaw;

      const design = template.design ? JSON.parse(JSON.stringify(template.design)) : {};

      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const copyUploadFile = async (maybeUploadPath) => {
        if (!maybeUploadPath || typeof maybeUploadPath !== 'string') return maybeUploadPath;
        if (!maybeUploadPath.startsWith('/uploads/')) return maybeUploadPath;

        const rel = maybeUploadPath.replace('/uploads/', '');
        const srcPath = path.join(uploadDir, rel);
        const base = path.basename(rel);
        const ext = path.extname(base);
        const destFile = buildUniqueFileName({ prefix: 'copy', originalName: base, extOverride: ext });
        const destPath = path.join(uploadDir, destFile);

        try {
          await fs.copyFile(srcPath, destPath);
          return `/uploads/${destFile}`;
        } catch (error) {
          console.log(`Failed to copy upload file (kept original): ${srcPath} -> ${destPath} (${error.message})`);
          return maybeUploadPath;
        }
      };

      const normalizePages = (d) => {
        if (d?.pages && Array.isArray(d.pages) && d.pages.length) return d.pages;
        return [{
          objects: Array.isArray(d?.objects) ? d.objects : [],
          background: d?.background || null
        }];
      };

      const pages = normalizePages(design);
      for (const page of pages) {
        if (page && page.background) {
          page.background = await copyUploadFile(page.background);
        }
        if (page && Array.isArray(page.objects)) {
          for (const obj of page.objects) {
            if (obj && obj.type === 'image' && obj.src) {
              obj.src = await copyUploadFile(obj.src);
            }
            if (obj && obj.type === 'qrcode' && obj.logoSrc) {
              obj.logoSrc = await copyUploadFile(obj.logoSrc);
            }
          }
        }
      }
      if (design?.pages && Array.isArray(design.pages)) {
        design.pages = pages;
      } else {
        const only = pages[0] || { objects: [], background: null };
        design.objects = only.objects;
        design.background = only.background;
      }

      const backgroundImage = await copyUploadFile(template.backgroundImage || null);

      let destinationEventId = template.eventId;
      if (targetEventId) {
        const destEvent = await this.getEventByUuid(targetEventId, userId);
        destinationEventId = destEvent.id;
      }

      const copied = await CertificateTemplate.create({
        name: nextName,
        design,
        backgroundImage,
        width: template.width,
        height: template.height,
        eventId: destinationEventId,
        isActive: true
      });

      return copied;
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
