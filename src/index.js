const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const winston = require('winston');

// Load environment variables
dotenv.config();

// Import services
const ImapSyncService = require('./services/imapSyncService');
const ElasticsearchService = require('./services/elasticsearchService');
const AICategorizationService = require('./services/aiCategorizationService');
const SlackService = require('./services/slackService');
const WebhookService = require('./services/webhookService');
const EmailRoutes = require('./routes/emailRoutes');
const SearchRoutes = require('./routes/searchRoutes');
const AICategorizationRoutes = require('./routes/aiCategorizationRoutes');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class ReachinboxApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.port = process.env.PORT || 3000;
    
    // Initialize services
    this.elasticsearchService = new ElasticsearchService();
    this.aiCategorizationService = new AICategorizationService();
    this.slackService = new SlackService();
    this.webhookService = new WebhookService();
    this.imapSyncService = new ImapSyncService(
      this.elasticsearchService,
      this.aiCategorizationService,
      this.slackService,
      this.webhookService,
      this.io
    );
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: {
          elasticsearch: this.elasticsearchService.isConnected(),
          imap: this.imapSyncService.isRunning()
        }
      });
    });

    // API routes
    this.app.use('/api/emails', new EmailRoutes(this.elasticsearchService).router);
    this.app.use('/api/search', new SearchRoutes(this.elasticsearchService).router);
    this.app.use('/api/ai', new AICategorizationRoutes(this.aiCategorizationService).router);

    // Serve static files for frontend
    this.app.use(express.static('public'));

    // Error handling
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
      });
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
      });

      // Join room for real-time updates
      socket.on('join-email-updates', () => {
        socket.join('email-updates');
        logger.info('Client joined email updates room:', socket.id);
      });
    });
  }

  async start() {
    try {
      // Initialize Elasticsearch
      await this.elasticsearchService.initialize();
      logger.info('Elasticsearch initialized');

      // Initialize AI service with vector database
      await this.aiCategorizationService.initialize();
      await this.aiCategorizationService.initializeDefaultTrainingData();
      logger.info('AI categorization service initialized');

      // Start IMAP sync service
      await this.imapSyncService.start();
      logger.info('IMAP sync service started');

      // Start server
      this.server.listen(this.port, () => {
        logger.info(`Reachinbox server running on port ${this.port}`);
        logger.info(`Health check: http://localhost:${this.port}/health`);
        logger.info(`API docs: http://localhost:${this.port}/api`);
      });

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop() {
    logger.info('Shutting down application...');
    
    // Stop IMAP sync service
    await this.imapSyncService.stop();
    
    // Close server
    this.server.close(() => {
      logger.info('Application stopped');
      process.exit(0);
    });
  }
}

// Handle graceful shutdown
const app = new ReachinboxApp();

process.on('SIGINT', () => app.stop());
process.on('SIGTERM', () => app.stop());

// Start the application
app.start().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

module.exports = ReachinboxApp;
