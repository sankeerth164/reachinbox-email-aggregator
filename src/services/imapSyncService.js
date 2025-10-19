const Imap = require('imap');
const { simpleParser } = require('mailparser');
const moment = require('moment');
const winston = require('winston');

class ImapSyncService {
  constructor(elasticsearchService, aiCategorizationService, slackService, webhookService, io) {
    this.elasticsearchService = elasticsearchService;
    this.aiCategorizationService = aiCategorizationService;
    this.slackService = slackService;
    this.webhookService = webhookService;
    this.io = io;
    this.connections = new Map();
    this.isRunning = false;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/imap-sync.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async start() {
    try {
      this.logger.info('Starting IMAP sync service...');
      
      const emailAccounts = process.env.EMAIL_ACCOUNTS?.split(',') || [];
      const emailPasswords = process.env.EMAIL_PASSWORDS?.split(',') || [];
      
      if (emailAccounts.length === 0) {
        throw new Error('No email accounts configured');
      }

      if (emailAccounts.length !== emailPasswords.length) {
        throw new Error('Email accounts and passwords count mismatch');
      }

      // Initialize connections for each email account
      for (let i = 0; i < emailAccounts.length; i++) {
        const email = emailAccounts[i].trim();
        const password = emailPasswords[i].trim();
        
        await this.initializeConnection(email, password);
      }

      this.isRunning = true;
      this.logger.info('IMAP sync service started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start IMAP sync service:', error);
      throw error;
    }
  }

  async initializeConnection(email, password) {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: email,
        password: password,
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: parseInt(process.env.IMAP_PORT) || 993,
        tls: process.env.IMAP_SECURE === 'true',
        tlsOptions: { rejectUnauthorized: false }
      });

      imap.once('ready', async () => {
        this.logger.info(`Connected to IMAP for ${email}`);
        this.connections.set(email, imap);
        
        try {
          // Initial sync - fetch last 30 days
          await this.syncEmails(email, imap);
          
          // Set up IDLE mode for real-time updates
          this.setupIdleMode(email, imap);
          
          resolve();
        } catch (error) {
          this.logger.error(`Error during initial sync for ${email}:`, error);
          reject(error);
        }
      });

      imap.once('error', (err) => {
        this.logger.error(`IMAP connection error for ${email}:`, err);
        reject(err);
      });

      imap.once('end', () => {
        this.logger.info(`IMAP connection ended for ${email}`);
        this.connections.delete(email);
      });

      imap.connect();
    });
  }

  async syncEmails(email, imap) {
    return new Promise((resolve, reject) => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          this.logger.error(`Error opening INBOX for ${email}:`, err);
          return reject(err);
        }

        // Search for emails from last 30 days
        const thirtyDaysAgo = moment().subtract(30, 'days').format('DD-MMM-YYYY');
        const searchCriteria = ['SINCE', thirtyDaysAgo];
        
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            this.logger.error(`Error searching emails for ${email}:`, err);
            return reject(err);
          }

          if (!results || results.length === 0) {
            this.logger.info(`No emails found for ${email} in last 30 days`);
            return resolve();
          }

          this.logger.info(`Found ${results.length} emails for ${email}, processing...`);

          const fetch = imap.fetch(results, { bodies: '', struct: true });
          let processedCount = 0;

          fetch.on('message', (msg, seqno) => {
            this.processEmailMessage(msg, email, seqno, () => {
              processedCount++;
              if (processedCount === results.length) {
                this.logger.info(`Completed initial sync for ${email}: ${processedCount} emails processed`);
                resolve();
              }
            });
          });

          fetch.once('error', (err) => {
            this.logger.error(`Error fetching emails for ${email}:`, err);
            reject(err);
          });

          fetch.once('end', () => {
            this.logger.info(`Fetch completed for ${email}`);
          });
        });
      });
    });
  }

  processEmailMessage(msg, email, seqno, callback) {
    let buffer = '';
    let attributes = {};

    msg.on('body', (stream, info) => {
      stream.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
      });
    });

    msg.on('attributes', (attrs) => {
      attributes = attrs;
    });

    msg.once('end', async () => {
      try {
        const parsed = await simpleParser(buffer);
        
        const emailData = {
          id: `${email}_${attributes.uid}`,
          uid: attributes.uid,
          email: email,
          from: parsed.from?.text || '',
          to: parsed.to?.text || '',
          subject: parsed.subject || '',
          date: parsed.date || new Date(),
          text: parsed.text || '',
          html: parsed.html || '',
          attachments: parsed.attachments || [],
          folder: 'INBOX',
          flags: attributes.flags || [],
          size: attributes.size || 0,
          messageId: parsed.messageId || '',
          inReplyTo: parsed.inReplyTo || '',
          references: parsed.references || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Store in Elasticsearch
        await this.elasticsearchService.indexEmail(emailData);

        // Categorize with AI
        const category = await this.aiCategorizationService.categorizeEmail(emailData);
        emailData.category = category;

        // Update with category
        await this.elasticsearchService.updateEmailCategory(emailData.id, category);

        // Send notifications for interested emails
        if (category === 'Interested') {
          await this.slackService.sendNotification(emailData);
          await this.webhookService.triggerWebhook(emailData);
        }

        // Emit real-time update
        this.io.to('email-updates').emit('new-email', {
          id: emailData.id,
          from: emailData.from,
          subject: emailData.subject,
          category: category,
          date: emailData.date
        });

        this.logger.info(`Processed email: ${emailData.subject} (${category})`);
        callback();

      } catch (error) {
        this.logger.error(`Error processing email for ${email}:`, error);
        callback();
      }
    });
  }

  setupIdleMode(email, imap) {
    const checkForNewEmails = () => {
      if (!this.connections.has(email)) return;

      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          this.logger.error(`Error opening INBOX for IDLE check ${email}:`, err);
          return;
        }

        // Check for new emails since last check
        const lastCheck = moment().subtract(1, 'minute').format('DD-MMM-YYYY');
        const searchCriteria = ['SINCE', lastCheck];
        
        imap.search(searchCriteria, (err, results) => {
          if (err) {
            this.logger.error(`Error searching for new emails ${email}:`, err);
            return;
          }

          if (results && results.length > 0) {
            this.logger.info(`Found ${results.length} new emails for ${email}`);
            
            const fetch = imap.fetch(results, { bodies: '', struct: true });
            let processedCount = 0;

            fetch.on('message', (msg, seqno) => {
              this.processEmailMessage(msg, email, seqno, () => {
                processedCount++;
                if (processedCount === results.length) {
                  this.logger.info(`Processed ${processedCount} new emails for ${email}`);
                }
              });
            });
          }
        });
      });
    };

    // Check for new emails every minute
    setInterval(checkForNewEmails, 60000);
    
    this.logger.info(`IDLE mode setup completed for ${email}`);
  }

  async stop() {
    this.logger.info('Stopping IMAP sync service...');
    this.isRunning = false;
    
    for (const [email, connection] of this.connections) {
      try {
        connection.end();
        this.logger.info(`Closed connection for ${email}`);
      } catch (error) {
        this.logger.error(`Error closing connection for ${email}:`, error);
      }
    }
    
    this.connections.clear();
    this.logger.info('IMAP sync service stopped');
  }

  isRunning() {
    return this.isRunning;
  }

  getConnectionStatus() {
    const status = {};
    for (const [email, connection] of this.connections) {
      status[email] = connection.state;
    }
    return status;
  }
}

module.exports = ImapSyncService;
