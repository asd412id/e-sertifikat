const fastify = require('fastify')({
  logger: process.env.NODE_ENV === 'development',
  // Increase request timeout for long-running operations
  requestTimeout: 900000, // 15 minutes
  // Increase keep-alive timeout
  keepAliveTimeout: 900000 // 15 minutes
});

// Load environment variables
require('dotenv').config();

// Register plugins
async function start() {
  try {
    // Register CORS
    await fastify.register(require('@fastify/cors'), {
      origin: process.env.ORIGINS?.split('|') || ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    });

    // Register multipart for file uploads
    await fastify.register(require('@fastify/multipart'), {
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
      }
    });

    // Register static file serving for uploads
    await fastify.register(require('@fastify/static'), {
      root: require('path').join(__dirname, 'uploads'),
      prefix: '/api/uploads/'
    });

    // Register static file serving for fonts (local cached Google Fonts)
    await fastify.register(require('@fastify/static'), {
      root: require('path').join(__dirname, 'fonts'),
      prefix: '/api/fonts/',
      decorateReply: false
    });

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return { status: 'OK', timestamp: new Date().toISOString() };
    });

    // Register routes
    await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
    await fastify.register(require('./routes/events'), { prefix: '/api/events' });
    await fastify.register(require('./routes/participants'), { prefix: '/api' });
    await fastify.register(require('./routes/certificates'), { prefix: '/api/certificates' });
    await fastify.register(require('./routes/assets'), { prefix: '/api/assets' });

    // Initialize database
    const { sequelize, Event } = require('./models');
    const AssetService = require('./services/AssetService');

    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync database (create tables if they don't exist)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false, alter: true });
      console.log('Database synchronized.');
    } else {
      await sequelize.sync();
      console.log('Database synchronized in production mode.');
    }

    // Start server
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);

    const autoBackfillEnabled = String(process.env.AUTO_ASSET_BACKFILL_ON_STARTUP || 'true').toLowerCase() !== 'false';
    if (autoBackfillEnabled) {
      const startupDelayMs = Math.max(0, parseInt(process.env.AUTO_ASSET_BACKFILL_STARTUP_DELAY_MS, 10) || 1000);
      const perUserDelayMs = Math.max(0, parseInt(process.env.AUTO_ASSET_BACKFILL_USER_DELAY_MS, 10) || 100);

      setTimeout(async () => {
        try {
          const rows = await Event.findAll({
            where: { isActive: true },
            attributes: ['userId'],
            group: ['userId'],
            raw: true
          });
          const userIds = Array.from(new Set((rows || []).map((r) => r?.userId).filter((x) => x != null)));

          console.log(`[asset-backfill] Starting auto backfill for ${userIds.length} users`);

          for (let i = 0; i < userIds.length; i += 1) {
            const userId = userIds[i];
            try {
              const result = await AssetService.backfillUserAssetsFromTemplates(userId);
              console.log(`[asset-backfill] userId=${userId} created=${result.createdCount} skipped=${result.skippedCount} missing=${result.missingFilesCount}`);
            } catch (e) {
              console.log(`[asset-backfill] userId=${userId} failed: ${e?.message || e}`);
            }

            if (perUserDelayMs > 0 && i < userIds.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, perUserDelayMs));
            }
          }

          console.log('[asset-backfill] Completed auto backfill');

          const cleanupEnabled = String(process.env.AUTO_ASSET_CLEANUP_ON_STARTUP || 'true').toLowerCase() !== 'false';
          if (cleanupEnabled) {
            const dryRun = String(process.env.AUTO_ASSET_CLEANUP_DRY_RUN || 'false').toLowerCase() === 'true';
            try {
              const cleanup = await AssetService.cleanupOrphanUploadFiles({ dryRun });
              console.log(`[asset-cleanup] deleted=${cleanup.deletedCount} skipped=${cleanup.skippedCount} errors=${cleanup.errorsCount} dryRun=${dryRun}`);
            } catch (e) {
              console.log(`[asset-cleanup] failed: ${e?.message || e}`);
            }
          }
        } catch (e) {
          console.log(`[asset-backfill] Failed to run auto backfill: ${e?.message || e}`);
        }
      }, startupDelayMs);
    }

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

start();
