const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const CertificateService = require('./CertificateService');

class CertificateJobService {
  constructor() {
    this.jobs = new Map();
    this.queue = [];
    this.active = 0;
    this.sweeper = null;
  }

  _getMaxQueueSize() {
    const v = parseInt(process.env.CERTIFICATE_JOB_MAX_QUEUE, 10);
    if (Number.isFinite(v) && v > 0) return Math.min(v, 5000);
    return 500;
  }

  _getMaxJobsRetained() {
    const v = parseInt(process.env.CERTIFICATE_JOB_MAX_JOBS, 10);
    if (Number.isFinite(v) && v > 0) return Math.min(v, 10000);
    return 2000;
  }

  _getConcurrency() {
    const v = parseInt(process.env.CERTIFICATE_JOB_CONCURRENCY || process.env.PUPPETEER_PDF_CONCURRENCY || process.env.CERTIFICATE_CONCURRENCY_LIMIT, 10);
    if (Number.isFinite(v) && v > 0) return Math.min(v, 16);
    return 2;
  }

  _getTtlMs() {
    const v = parseInt(process.env.CERTIFICATE_JOB_TTL_MS, 10);
    if (Number.isFinite(v) && v > 0) return v;
    return 30 * 60 * 1000;
  }

  _getStorageDir() {
    const base = process.env.CERTIFICATE_JOB_DIR
      ? path.resolve(process.env.CERTIFICATE_JOB_DIR)
      : path.join(__dirname, '..', 'temp', 'certificate_jobs');
    return base;
  }

  _ensureSweeper() {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      try {
        this.cleanupExpired().catch(() => {});
      } catch (_) {}
    }, 60 * 1000);
    if (this.sweeper.unref) this.sweeper.unref();
  }

  async enqueueIndividualPdfJob({ templateUuid, participantUuid, userId }) {
    this._ensureSweeper();

    const maxQueue = this._getMaxQueueSize();
    if (this.queue.length >= maxQueue) {
      throw new Error('Queue is full, please retry later');
    }

    // Avoid unbounded memory usage
    const maxJobs = this._getMaxJobsRetained();
    if (this.jobs.size >= maxJobs) {
      await this.cleanupExpired();
      if (this.jobs.size >= maxJobs) {
        throw new Error('Server is busy, please retry later');
      }
    }

    const jobId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const job = {
      id: jobId,
      type: 'individual_pdf',
      templateUuid: String(templateUuid),
      participantUuid: String(participantUuid),
      userId,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      filePath: null,
      fileName: null,
      error: null
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    this._drain();

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(String(jobId)) || null;
  }

  async cleanupExpired() {
    const ttl = this._getTtlMs();
    const now = Date.now();

    for (const [id, job] of this.jobs.entries()) {
      if (!job) {
        this.jobs.delete(id);
        continue;
      }

      const updatedAt = job.updatedAt || job.createdAt || 0;
      if (now - updatedAt < ttl) continue;

      if (job.filePath) {
        try {
          if (fsSync.existsSync(job.filePath)) {
            await fs.unlink(job.filePath);
          }
        } catch (_) {}
      }

      this.jobs.delete(id);
    }
  }

  _drain() {
    const limit = this._getConcurrency();
    while (this.active < limit && this.queue.length > 0) {
      const jobId = this.queue.shift();
      const job = this.jobs.get(jobId);
      if (!job) continue;

      this.active++;
      this._runJob(job).finally(() => {
        this.active = Math.max(0, this.active - 1);
        this._drain();
      });
    }
  }

  async _runJob(job) {
    job.status = 'running';
    job.updatedAt = Date.now();

    try {
      const storageDir = this._getStorageDir();
      await fs.mkdir(storageDir, { recursive: true });

      const template = await CertificateService.getTemplateById(job.templateUuid, job.userId);

      const { Participant } = require('../models');
      const participant = await Participant.findOne({
        where: { uuid: job.participantUuid, eventId: template.eventId }
      });

      if (!participant) {
        throw new Error('Participant not found');
      }

      const PuppeteerPDFService = require('./PuppeteerPDFService');
      const pdfBuffer = await PuppeteerPDFService.createPDF(template, participant);

      if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        throw new Error('Failed to generate PDF');
      }

      const safeName = String(participant.data?.nama || participant.data?.name || 'participant')
        .replace(/[^-\u007E\s-]/g, '')
        .replace(/[^\w\s-]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);

      const unique = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      const fileName = `sertifikat_${safeName}_${participant.uuid}_${unique}.pdf`;
      const filePath = path.join(storageDir, `${job.id}.pdf`);

      await fs.writeFile(filePath, pdfBuffer);

      job.filePath = filePath;
      job.fileName = fileName;
      job.status = 'done';
      job.updatedAt = Date.now();
      job.error = null;
    } catch (e) {
      job.status = 'failed';
      job.updatedAt = Date.now();
      job.error = e?.message || String(e);
    }
  }
}

module.exports = new CertificateJobService();
