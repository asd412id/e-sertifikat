const CertificateController = require('../controllers/CertificateController');
const { authenticateToken } = require('../middleware/auth');

async function certificateRoutes(fastify, options) {
  // All certificate routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  // Template management
  fastify.post('/templates', CertificateController.createTemplate);
  fastify.get('/events/:eventId/templates', CertificateController.getTemplates);
  fastify.get('/templates/:id', CertificateController.getTemplateById);
  fastify.put('/templates/:id', CertificateController.updateTemplate);
  fastify.delete('/templates/:id', CertificateController.deleteTemplate);

  // Generate and download individual certificate (legacy - will be deprecated)
  fastify.post('/templates/:templateId/participants/:participantId/generate-download',
    CertificateController.generateAndDownloadCertificate);
    
  // New endpoint for individual certificate download using bulk generation approach
  fastify.post('/templates/:templateId/participants/:participantId/download-pdf',
    CertificateController.downloadIndividualCertificatePDF);

  // File upload and download
  fastify.post('/upload-background', CertificateController.uploadBackgroundImage);

  // Public download route (no auth required for download)
  fastify.get('/download/:filename', { preHandler: [] }, CertificateController.downloadCertificate);

  // Bulk download certificates as single PDF (replacing ZIP download)
  fastify.post('/events/:eventId/templates/:templateId/bulk-download-pdf', CertificateController.bulkDownloadCertificatesPDF);
}

module.exports = certificateRoutes;
