const AssetController = require('../controllers/AssetController');
const { authenticateToken } = require('../middleware/auth');

async function assetRoutes(fastify, options) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', AssetController.listAssets);
  fastify.post('/upload', AssetController.uploadAsset);
  fastify.post('/backfill', AssetController.backfillAssets);
  fastify.delete('/:fileName', AssetController.deleteAsset);
}

module.exports = assetRoutes;
