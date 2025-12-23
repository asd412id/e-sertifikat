const CertificateController = require('../controllers/CertificateController');
const { authenticateToken } = require('../middleware/auth');

async function certificateRoutes(fastify, options) {
  // Public certificate verification (QR) endpoint (no auth)
  fastify.get('/verify', CertificateController.verifyCertificate);

  // Public QR preview for editor (no auth)
  fastify.post('/qr-preview', CertificateController.previewQrCode);

  // Public portal endpoints (no auth)
  fastify.get('/public/events', CertificateController.getPublicDownloadEvents);
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

  // Issued certificate management (auth)
  fastify.get(
    '/issued',
    { preHandler: authenticateToken },
    CertificateController.getIssuedCertificates
  );

  fastify.put(
    '/issued/:token/approve',
    { preHandler: authenticateToken },
    CertificateController.approveIssuedCertificate
  );

  fastify.put(
    '/issued/:token/revoke',
    { preHandler: authenticateToken },
    CertificateController.revokeIssuedCertificate
  );

  fastify.delete(
    '/issued/:token',
    { preHandler: authenticateToken },
    CertificateController.deleteIssuedCertificate
  );
}

module.exports = certificateRoutes;
