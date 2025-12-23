const AssetService = require('../services/AssetService');

class AssetController {
  async listAssets(request, reply) {
    try {
      const assets = await AssetService.getUserAssets(request.user.userId);
      reply.send({
        success: true,
        data: { assets }
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

      const result = await AssetService.deleteAssetByFileName(request.user.userId, fileName, force);

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
