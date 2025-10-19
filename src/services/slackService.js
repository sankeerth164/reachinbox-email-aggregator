const axios = require('axios');
const winston = require('winston');

class SlackService {
  constructor() {
    this.webhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/slack.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async sendNotification(emailData) {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Slack webhook URL not configured');
        return false;
      }

      const message = this.buildSlackMessage(emailData);
      
      const response = await axios.post(this.webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        this.logger.info(`Slack notification sent for email: ${emailData.subject}`);
        return true;
      } else {
        this.logger.error(`Slack notification failed: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error sending Slack notification:', error);
      return false;
    }
  }

  buildSlackMessage(emailData) {
    const date = new Date(emailData.date).toLocaleString();
    
    return {
      text: "🎯 New Interested Email Received",
      attachments: [
        {
          color: "good",
          fields: [
            {
              title: "From",
              value: emailData.from,
              short: true
            },
            {
              title: "To",
              value: emailData.to,
              short: true
            },
            {
              title: "Subject",
              value: emailData.subject,
              short: false
            },
            {
              title: "Date",
              value: date,
              short: true
            },
            {
              title: "Account",
              value: emailData.email,
              short: true
            },
            {
              title: "Category",
              value: emailData.category || 'Interested',
              short: true
            }
          ],
          footer: "Reachinbox Email Aggregator",
          ts: Math.floor(new Date(emailData.date).getTime() / 1000)
        }
      ]
    };
  }

  async sendCustomMessage(message, channel = null) {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Slack webhook URL not configured');
        return false;
      }

      const payload = {
        text: message
      };

      if (channel) {
        payload.channel = channel;
      }

      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        this.logger.info('Custom Slack message sent');
        return true;
      } else {
        this.logger.error(`Custom Slack message failed: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error sending custom Slack message:', error);
      return false;
    }
  }

  async sendErrorNotification(error, context = '') {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Slack webhook URL not configured');
        return false;
      }

      const message = {
        text: "🚨 Error Alert",
        attachments: [
          {
            color: "danger",
            fields: [
              {
                title: "Error",
                value: error.message || error,
                short: false
              },
              {
                title: "Context",
                value: context || 'No context provided',
                short: false
              },
              {
                title: "Timestamp",
                value: new Date().toISOString(),
                short: true
              }
            ],
            footer: "Reachinbox Error Monitor"
          }
        ]
      };

      const response = await axios.post(this.webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        this.logger.info('Error notification sent to Slack');
        return true;
      } else {
        this.logger.error(`Error notification failed: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error sending error notification:', error);
      return false;
    }
  }

  async sendStatsNotification(stats) {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('Slack webhook URL not configured');
        return false;
      }

      const message = {
        text: "📊 Daily Email Stats",
        attachments: [
          {
            color: "good",
            fields: [
              {
                title: "Total Emails",
                value: stats.totalEmails || 0,
                short: true
              },
              {
                title: "Interested Emails",
                value: stats.interestedEmails || 0,
                short: true
              },
              {
                title: "Meeting Booked",
                value: stats.meetingBooked || 0,
                short: true
              },
              {
                title: "Not Interested",
                value: stats.notInterested || 0,
                short: true
              },
              {
                title: "Spam",
                value: stats.spam || 0,
                short: true
              },
              {
                title: "Out of Office",
                value: stats.outOfOffice || 0,
                short: true
              }
            ],
            footer: "Reachinbox Daily Report",
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      const response = await axios.post(this.webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        this.logger.info('Stats notification sent to Slack');
        return true;
      } else {
        this.logger.error(`Stats notification failed: ${response.status}`);
        return false;
      }

    } catch (error) {
      this.logger.error('Error sending stats notification:', error);
      return false;
    }
  }

  isConfigured() {
    return !!this.webhookUrl;
  }
}

module.exports = SlackService;
