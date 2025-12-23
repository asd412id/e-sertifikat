const AssetService = require('../services/AssetService');

class AssetController {
  async listAssets(request, reply) {
    try {
      const { page = 1, limit = 50, q = '' } = request.query || {};
      const result = await AssetService.getUserAssets(request.user.userId, page, limit, q);
      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      reply.status(500).send({
        error: error.message
      });
    }
  }

  async uploadAsset(request, reply) {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded'
        });
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (data.mimetype && !allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Only image files are supported'
        });
      }

      const rec = await AssetService.createAssetFromUploadedFile({
        userId: request.user.userId,
        buffer: await data.toBuffer(),
        originalName: data.filename,
        mimetype: data.mimetype
      });

      reply.send({
        success: true,
        message: 'Asset uploaded successfully',
        data: {
          uuid: rec.uuid,
          filename: rec.storedFileName,
          url: rec.path,
          originalFileName: rec.originalFileName,
          mimeType: rec.mimeType,
          ext: rec.ext,
          sizeBytes: rec.sizeBytes
        }
      });
    } catch (error) {
      reply.status(500).send({
        error: error.message
      });
    }
  }

  async backfillAssets(request, reply) {
    try {
      const result = await AssetService.backfillUserAssetsFromTemplates(request.user.userId);

      const dryRun = request.query?.dryRun === '1' || request.query?.dryRun === 'true';
      const cleanup = await AssetService.cleanupOrphanUploadFiles({ dryRun });
      reply.send({
        success: true,
        message: 'Asset backfill completed',
        data: {
          backfill: result,
          cleanup
        }
      });
    } catch (error) {
      reply.status(500).send({
        error: error.message
      });
    }
  }

  async deleteAsset(request, reply) {
    try {
      const { fileName } = request.params;
      const force = request.query?.force === '1' || request.query?.force === 'true';

      const result = await AssetService.deleteAssetByIdentifier(request.user.userId, fileName, force);

      reply.send({
        success: true,
        message: 'Asset deleted successfully',
        data: result
      });
    } catch (error) {
      const code = error.statusCode || 500;
      reply.status(code).send({
        error: error.message,
        data: error.data
      });
    }
  }
}

module.exports = new AssetController();
