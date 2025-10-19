const express = require('express');
const Joi = require('joi');

class AICategorizationRoutes {
  constructor(aiCategorizationService) {
    this.router = express.Router();
    this.aiCategorizationService = aiCategorizationService;
    this.setupRoutes();
  }

  setupRoutes() {
    // Categorize single email
    this.router.post('/categorize', this.categorizeEmail.bind(this));
    
    // Batch categorize emails
    this.router.post('/categorize/batch', this.batchCategorizeEmails.bind(this));
    
    // Generate suggested reply
    this.router.post('/reply/suggest', this.generateSuggestedReply.bind(this));
    
    // Get available categories
    this.router.get('/categories', this.getCategories.bind(this));
    
    // Get categorization statistics
    this.router.get('/stats', this.getCategorizationStats.bind(this));
    
    // Test AI service
    this.router.get('/test', this.testAIService.bind(this));
    
    // Training data management
    this.router.post('/training-data', this.storeTrainingData.bind(this));
    this.router.get('/training-data/search', this.searchTrainingData.bind(this));
    this.router.delete('/training-data/:id', this.deleteTrainingData.bind(this));
    this.router.get('/training-data/stats', this.getTrainingDataStats.bind(this));
  }

  async categorizeEmail(req, res) {
    try {
      const schema = Joi.object({
        id: Joi.string().required(),
        from: Joi.string().required(),
        to: Joi.string().required(),
        subject: Joi.string().required(),
        text: Joi.string().required(),
        date: Joi.date().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const emailData = {
        id: value.id,
        from: value.from,
        to: value.to,
        subject: value.subject,
        text: value.text,
        date: value.date
      };

      const category = await this.aiCategorizationService.categorizeEmail(emailData);

      res.json({
        success: true,
        data: {
          id: emailData.id,
          category: category,
          confidence: 'high' // This would be calculated by the AI service
        }
      });

    } catch (error) {
      console.error('Error categorizing email:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to categorize email'
      });
    }
  }

  async batchCategorizeEmails(req, res) {
    try {
      const schema = Joi.object({
        emails: Joi.array().items(
          Joi.object({
            id: Joi.string().required(),
            from: Joi.string().required(),
            to: Joi.string().required(),
            subject: Joi.string().required(),
            text: Joi.string().required(),
            date: Joi.date().required()
          })
        ).min(1).max(50).required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const results = await this.aiCategorizationService.batchCategorizeEmails(value.emails);

      res.json({
        success: true,
        data: {
          results: results,
          count: results.length
        }
      });

    } catch (error) {
      console.error('Error batch categorizing emails:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to batch categorize emails'
      });
    }
  }

  async generateSuggestedReply(req, res) {
    try {
      const schema = Joi.object({
        email: Joi.object({
          id: Joi.string().required(),
          from: Joi.string().required(),
          to: Joi.string().required(),
          subject: Joi.string().required(),
          text: Joi.string().required(),
          date: Joi.date().required()
        }).required(),
        trainingData: Joi.string().required()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const suggestedReply = await this.aiCategorizationService.generateSuggestedReply(
        value.email,
        value.trainingData
      );

      res.json({
        success: true,
        data: {
          id: value.email.id,
          suggestedReply: suggestedReply,
          originalEmail: {
            from: value.email.from,
            subject: value.email.subject,
            text: value.email.text
          }
        }
      });

    } catch (error) {
      console.error('Error generating suggested reply:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to generate suggested reply'
      });
    }
  }

  async getCategories(req, res) {
    try {
      const categories = this.aiCategorizationService.getCategories();

      res.json({
        success: true,
        data: {
          categories: categories,
          count: categories.length
        }
      });

    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get categories'
      });
    }
  }

  async getCategorizationStats(req, res) {
    try {
      const stats = await this.aiCategorizationService.getCategorizationStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error getting categorization stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get categorization statistics'
      });
    }
  }

  async testAIService(req, res) {
    try {
      const testEmail = {
        id: 'test-email-123',
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'Test Email for AI Categorization',
        text: 'This is a test email to verify AI categorization is working properly.',
        date: new Date()
      };

      const category = await this.aiCategorizationService.categorizeEmail(testEmail);

      res.json({
        success: true,
        data: {
          message: 'AI service is working',
          testResult: {
            email: testEmail,
            category: category
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error testing AI service:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'AI service test failed',
        details: error.message
      });
    }
  }

  async storeTrainingData(req, res) {
    try {
      const schema = Joi.object({
        content: Joi.string().required(),
        category: Joi.string().optional(),
        metadata: Joi.object().optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const success = await this.aiCategorizationService.storeTrainingData(
        value.content,
        value.category || 'general',
        value.metadata || {}
      );

      if (success) {
        res.json({
          success: true,
          message: 'Training data stored successfully'
        });
      } else {
        res.status(500).json({
          error: 'Failed to store training data'
        });
      }

    } catch (error) {
      console.error('Error storing training data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to store training data'
      });
    }
  }

  async searchTrainingData(req, res) {
    try {
      const schema = Joi.object({
        query: Joi.string().required(),
        topK: Joi.number().integer().min(1).max(20).default(5)
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const results = await this.aiCategorizationService.getRelevantTrainingData(
        value.query,
        value.topK
      );

      res.json({
        success: true,
        data: {
          results: results,
          query: value.query,
          count: results.length
        }
      });

    } catch (error) {
      console.error('Error searching training data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to search training data'
      });
    }
  }

  async deleteTrainingData(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Training data ID is required'
        });
      }

      const success = await this.aiCategorizationService.deleteTrainingData(id);

      if (success) {
        res.json({
          success: true,
          message: 'Training data deleted successfully'
        });
      } else {
        res.status(500).json({
          error: 'Failed to delete training data'
        });
      }

    } catch (error) {
      console.error('Error deleting training data:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete training data'
      });
    }
  }

  async getTrainingDataStats(req, res) {
    try {
      const stats = await this.aiCategorizationService.getVectorDatabaseStats();

      res.json({
        success: true,
        data: stats || {
          message: 'Vector database not initialized',
          initialized: false
        }
      });

    } catch (error) {
      console.error('Error getting training data stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get training data statistics'
      });
    }
  }
}

module.exports = AICategorizationRoutes;
