const CertificateController = require('../controllers/CertificateController');
const { authenticateToken } = require('../middleware/auth');

async function certificateRoutes(fastify, options) {
  // Public portal endpoints (no auth)
  fastify.get('/public/:slug', CertificateController.getPublicDownloadPortalInfo);
  fastify.post('/public/:slug/search', CertificateController.publicSearchParticipants);
  fastify.post('/public/:slug/participants/:participantId/download-pdf', CertificateController.publicDownloadCertificatePDFByParticipant);
  fastify.post('/public/:slug/download-pdf', CertificateController.publicDownloadCertificatePDF);

  // Public legacy file download route (no auth)
  fastify.get('/download/:filename', CertificateController.downloadCertificate);

  // Template management (auth)
  fastify.post('/templates', { preHandler: authenticateToken }, CertificateController.createTemplate);
  fastify.get('/events/:eventId/templates', { preHandler: authenticateToken }, CertificateController.getTemplates);
  fastify.get('/templates/:id', { preHandler: authenticateToken }, CertificateController.getTemplateById);
  fastify.put('/templates/:id', { preHandler: authenticateToken }, CertificateController.updateTemplate);
  fastify.delete('/templates/:id', { preHandler: authenticateToken }, CertificateController.deleteTemplate);
  fastify.post('/templates/:id/copy', { preHandler: authenticateToken }, CertificateController.copyTemplate);

  // Generate and download individual certificate (legacy - will be deprecated) (auth)
  fastify.post(
    '/templates/:templateId/participants/:participantId/generate-download',
    { preHandler: authenticateToken },
    CertificateController.generateAndDownloadCertificate
  );

  // New endpoint for individual certificate download using bulk generation approach (auth)
  fastify.post(
    '/templates/:templateId/participants/:participantId/download-pdf',
    { preHandler: authenticateToken },
    CertificateController.downloadIndividualCertificatePDF
  );

  // Async job-based endpoints for high concurrent generation (auth)
  fastify.post(
    '/templates/:templateId/participants/:participantId/enqueue-pdf',
    { preHandler: authenticateToken },
    CertificateController.enqueueIndividualCertificatePDFJob
  );

  fastify.get(
    '/jobs/:jobId',
    { preHandler: authenticateToken },
    CertificateController.getCertificateJobStatus
  );

  fastify.get(
    '/jobs/:jobId/download',
    { preHandler: authenticateToken },
    CertificateController.downloadCertificateJobResult
  );

  // File upload (auth)
  fastify.post('/upload-background', { preHandler: authenticateToken }, CertificateController.uploadBackgroundImage);

  // Bulk download certificates as single PDF (auth)
  fastify.post(
    '/events/:eventId/templates/:templateId/bulk-download-pdf',
    { preHandler: authenticateToken },
    CertificateController.bulkDownloadCertificatesPDF
  );
}

module.exports = certificateRoutes;
