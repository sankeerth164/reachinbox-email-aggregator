const axios = require('axios');
const winston = require('winston');

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/webhook.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async triggerWebhook(emailData) {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Webhook URL not configured');
        return false;
      }

      const payload = this.buildWebhookPayload(emailData);
      
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Reachinbox-Webhook/1.0'
        },
        timeout: 10000 // 10 second timeout
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.info(`Webhook triggered successfully for email: ${emailData.subject}`);
        return true;
      } else {
        this.logger.error(`Webhook failed with status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error triggering webhook:', error);
      return false;
    }
  }

  buildWebhookPayload(emailData) {
    return {
      event: 'email.interested',
      timestamp: new Date().toISOString(),
      data: {
        id: emailData.id,
        uid: emailData.uid,
        email: emailData.email,
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        date: emailData.date,
        text: emailData.text,
        html: emailData.html,
        folder: emailData.folder,
        category: emailData.category,
        messageId: emailData.messageId,
        inReplyTo: emailData.inReplyTo,
        references: emailData.references,
        attachments: emailData.attachments || [],
        size: emailData.size,
        flags: emailData.flags || []
      },
      metadata: {
        source: 'reachinbox-email-aggregator',
        version: '1.0.0',
        processedAt: new Date().toISOString()
      }
    };
  }

  async triggerCustomWebhook(url, payload, headers = {}) {
    try {
      const defaultHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'Reachinbox-Webhook/1.0'
      };

      const response = await axios.post(url, payload, {
        headers: { ...defaultHeaders, ...headers },
        timeout: 10000
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.info(`Custom webhook triggered successfully to: ${url}`);
        return true;
      } else {
        this.logger.error(`Custom webhook failed with status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error triggering custom webhook:', error);
      return false;
    }
  }

  async triggerBatchWebhook(emails) {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Webhook URL not configured');
        return false;
      }

      const payload = {
        event: 'email.batch.interested',
        timestamp: new Date().toISOString(),
        count: emails.length,
        data: emails.map(email => this.buildWebhookPayload(email).data),
        metadata: {
          source: 'reachinbox-email-aggregator',
          version: '1.0.0',
          processedAt: new Date().toISOString()
        }
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Reachinbox-Webhook/1.0'
        },
        timeout: 15000 // Longer timeout for batch
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.info(`Batch webhook triggered successfully for ${emails.length} emails`);
        return true;
      } else {
        this.logger.error(`Batch webhook failed with status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error triggering batch webhook:', error);
      return false;
    }
  }

  async testWebhook() {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Webhook URL not configured');
        return false;
      }

      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        message: 'This is a test webhook from Reachinbox Email Aggregator',
        metadata: {
          source: 'reachinbox-email-aggregator',
          version: '1.0.0'
        }
      };

      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Reachinbox-Webhook/1.0'
        },
        timeout: 5000
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.info('Test webhook successful');
        return true;
      } else {
        this.logger.error(`Test webhook failed with status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error testing webhook:', error);
      return false;
    }
  }

  async triggerErrorWebhook(error, context = '') {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Webhook URL not configured');
        return false;
      }

      const payload = {
        event: 'error',
        timestamp: new Date().toISOString(),
        error: {
          message: error.message || error,
          stack: error.stack,
          context: context
        },
        metadata: {
          source: 'reachinbox-email-aggregator',
          version: '1.0.0',
          severity: 'error'
        }
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Reachinbox-Webhook/1.0'
        },
        timeout: 5000
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.info('Error webhook triggered successfully');
        return true;
      } else {
        this.logger.error(`Error webhook failed with status: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error triggering error webhook:', error);
      return false;
    }
  }

  isConfigured() {
    return !!this.webhookUrl;
  }

  getWebhookUrl() {
    return this.webhookUrl;
  }
}

module.exports = WebhookService;
