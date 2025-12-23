const AssetController = require('../controllers/AssetController');
const { authenticateToken } = require('../middleware/auth');

async function assetRoutes(fastify, options) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.get('/', AssetController.listAssets);
  fastify.delete('/:fileName', AssetController.deleteAsset);
}

module.exports = assetRoutes;
