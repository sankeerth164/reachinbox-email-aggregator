const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

// Set your real OpenAI API key for testing
process.env.OPENAI_API_KEY = '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';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class SimpleReachinboxApp {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        message: 'Reachinbox application is running!',
        services: {
          elasticsearch: 'Not connected (Docker required)',
          qdrant: 'Not connected (Docker required)',
          imap: 'Not started (Docker required)'
        }
      });
    });

    // Mock email endpoints
    this.app.get('/api/emails', (req, res) => {
      // Get filter parameters
      const { category, email, folder, query } = req.query;
      
      // Demo emails data
      const allEmails = [
        {
          id: 'demo-email-1',
          from: 'demo@example.com',
          to: 'user@company.com',
          subject: 'Demo Email - Meeting Request',
          text: 'This is a demo email to show the system is working!',
          date: new Date().toISOString(),
          category: 'Interested',
          folder: 'INBOX',
          email: 'user@company.com'
        },
        {
          id: 'demo-email-2',
          from: 'spam@fake.com',
          to: 'user@company.com',
          subject: 'Win $1000 Now!',
          text: 'This is a demo spam email.',
          date: new Date().toISOString(),
          category: 'Spam',
          folder: 'INBOX',
          email: 'user@company.com'
        },
        {
          id: 'demo-email-3',
          from: 'meeting@company.com',
          to: 'user@company.com',
          subject: 'Meeting Confirmed for Tomorrow',
          text: 'Your meeting has been confirmed for tomorrow at 2 PM.',
          date: new Date().toISOString(),
          category: 'Meeting Booked',
          folder: 'INBOX',
          email: 'user@company.com'
        },
        {
          id: 'demo-email-4',
          from: 'outofoffice@example.com',
          to: 'user@company.com',
          subject: 'Out of Office - Vacation',
          text: 'I will be out of office from Dec 20-30.',
          date: new Date().toISOString(),
          category: 'Out of Office',
          folder: 'INBOX',
          email: 'user@company.com'
        },
        {
          id: 'demo-email-5',
          from: 'notinterested@example.com',
          to: 'user@company.com',
          subject: 'Generic Marketing Email',
          text: 'This is a generic marketing email that is not interesting.',
          date: new Date().toISOString(),
          category: 'Not Interested',
          folder: 'INBOX',
          email: 'user@company.com'
        }
      ];

      // Apply filters
      let filteredEmails = allEmails;

      // Filter by category
      if (category && category !== '') {
        filteredEmails = filteredEmails.filter(email => email.category === category);
      }

      // Filter by email account
      if (email && email !== '') {
        filteredEmails = filteredEmails.filter(emailItem => emailItem.email === email);
      }

      // Filter by folder
      if (folder && folder !== '') {
        filteredEmails = filteredEmails.filter(emailItem => emailItem.folder === folder);
      }

      // Filter by search query
      if (query && query !== '') {
        const searchTerm = query.toLowerCase();
        filteredEmails = filteredEmails.filter(emailItem => 
          emailItem.subject.toLowerCase().includes(searchTerm) ||
          emailItem.text.toLowerCase().includes(searchTerm) ||
          emailItem.from.toLowerCase().includes(searchTerm)
        );
      }

      res.json({
        success: true,
        data: {
          emails: filteredEmails,
          pagination: {
            page: 1,
            size: 20,
            total: filteredEmails.length,
            pages: 1
          }
        }
      });
    });

    // Mock search endpoint
    this.app.get('/api/search', (req, res) => {
      const query = req.query.q || '';
      res.json({
        success: true,
        data: {
          emails: [
            {
              id: 'search-result-1',
              from: 'search@example.com',
              to: 'user@company.com',
              subject: `Search result for: ${query}`,
              text: `This is a search result for the query: ${query}`,
              date: new Date().toISOString(),
              category: 'Not Interested',
              folder: 'INBOX'
            }
          ],
          pagination: {
            page: 1,
            size: 20,
            total: 1,
            pages: 1
          },
          search: {
            query: query,
            took: 5
          }
        }
      });
    });

    // Mock AI endpoints
    this.app.get('/api/ai/categories', (req, res) => {
      res.json({
        success: true,
        data: {
          categories: ['Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office'],
          count: 5
        }
      });
    });

    this.app.post('/api/ai/categorize', (req, res) => {
      const { subject, text } = req.body;
      let category = 'Not Interested';
      
      if (subject && subject.toLowerCase().includes('meeting')) {
        category = 'Meeting Booked';
      } else if (text && text.toLowerCase().includes('interested')) {
        category = 'Interested';
      } else if (text && text.toLowerCase().includes('spam')) {
        category = 'Spam';
      }

      res.json({
        success: true,
        data: {
          id: req.body.id || 'demo-id',
          category: category,
          confidence: 'high'
        }
      });
    });

    this.app.post('/api/ai/reply/suggest', (req, res) => {
      const { email, trainingData } = req.body;
      
      const suggestedReply = `Thank you for your email about "${email.subject}". 

Based on your message, I would like to schedule a meeting to discuss this further. 

${trainingData || 'Please let me know your availability for next week.'}

Best regards,
[Your Name]`;

      res.json({
        success: true,
        data: {
          id: email.id,
          suggestedReply: suggestedReply,
          originalEmail: {
            from: email.from,
            subject: email.subject,
            text: email.text
          }
        }
      });
    });

    // Mock stats endpoint
    this.app.get('/api/emails/stats/overview', (req, res) => {
      res.json({
        success: true,
        data: {
          totalEmails: 5,
          byAccount: [
            { email: 'user@company.com', count: 5 }
          ],
          byCategory: [
            { category: 'Interested', count: 1 },
            { category: 'Spam', count: 1 },
            { category: 'Meeting Booked', count: 1 },
            { category: 'Out of Office', count: 1 },
            { category: 'Not Interested', count: 1 }
          ],
          byFolder: [
            { folder: 'INBOX', count: 5 }
          ]
        }
      });
    });

    // Serve static files for frontend
    this.app.use(express.static('public'));

    // Error handling
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong'
      });
    });
  }

  start() {
    this.app.listen(this.port, () => {
      logger.info(`Reachinbox Demo Server running on port ${this.port}`);
      logger.info(`Frontend: http://localhost:${this.port}`);
      logger.info(`Health check: http://localhost:${this.port}/health`);
      logger.info(`API: http://localhost:${this.port}/api/emails`);
      logger.info('');
      logger.info('This is a DEMO version without Docker services');
      logger.info('To run the full system:');
      logger.info('   1. Install Docker Desktop');
      logger.info('   2. Run: docker compose up -d');
      logger.info('   3. Run: npm start');
    });
  }
}

// Start the application
const app = new SimpleReachinboxApp();
app.start();
