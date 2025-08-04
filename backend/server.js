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

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return { status: 'OK', timestamp: new Date().toISOString() };
    });

    // Register routes
    await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
    await fastify.register(require('./routes/events'), { prefix: '/api/events' });
    await fastify.register(require('./routes/participants'), { prefix: '/api' });
    await fastify.register(require('./routes/certificates'), { prefix: '/api/certificates' });

    // Initialize database
    const { sequelize } = require('./models');

    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync database (create tables if they don't exist)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: false });
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
