const express = require('express');
const Joi = require('joi');

class EmailRoutes {
  constructor(elasticsearchService) {
    this.router = express.Router();
    this.elasticsearchService = elasticsearchService;
    this.setupRoutes();
  }

  setupRoutes() {
    // Get all emails with pagination and filtering
    this.router.get('/', this.getEmails.bind(this));
    
    // Get email by ID
    this.router.get('/:id', this.getEmailById.bind(this));
    
    // Get emails by account
    this.router.get('/account/:email', this.getEmailsByAccount.bind(this));
    
    // Get email statistics
    this.router.get('/stats/overview', this.getEmailStats.bind(this));
    
    // Get categories
    this.router.get('/stats/categories', this.getCategories.bind(this));
    
    // Get folders
    this.router.get('/stats/folders', this.getFolders.bind(this));
    
    // Delete email
    this.router.delete('/:id', this.deleteEmail.bind(this));
    
    // Update email category
    this.router.patch('/:id/category', this.updateEmailCategory.bind(this));
  }

  async getEmails(req, res) {
    try {
      const schema = Joi.object({
        query: Joi.string().allow('').optional(),
        email: Joi.string().email().optional(),
        folder: Joi.string().optional(),
        category: Joi.string().optional(),
        dateFrom: Joi.date().optional(),
        dateTo: Joi.date().optional(),
        page: Joi.number().integer().min(1).default(1),
        size: Joi.number().integer().min(1).max(100).default(20)
      });

      const { error, value } = schema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      const filters = {
        email: value.email,
        folder: value.folder,
        category: value.category,
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        from: (value.page - 1) * value.size,
        size: value.size
      };

      const result = await this.elasticsearchService.searchEmails(value.query, filters);

      res.json({
        success: true,
        data: {
          emails: result.hits,
          pagination: {
            page: value.page,
            size: value.size,
            total: result.total,
            pages: Math.ceil(result.total / value.size)
          },
          took: result.took
        }
      });

    } catch (error) {
      console.error('Error getting emails:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve emails'
      });
    }
  }

  async getEmailById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Email ID is required'
        });
      }

      const email = await this.elasticsearchService.getEmailById(id);

      if (!email) {
        return res.status(404).json({
          error: 'Email not found'
        });
      }

      res.json({
        success: true,
        data: email
      });

    } catch (error) {
      console.error('Error getting email by ID:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve email'
      });
    }
  }

  async getEmailsByAccount(req, res) {
    try {
      const { email } = req.params;

      if (!email) {
        return res.status(400).json({
          error: 'Email address is required'
        });
      }

      const emails = await this.elasticsearchService.getEmailsByAccount(email);

      res.json({
        success: true,
        data: {
          emails: emails,
          count: emails.length,
          account: email
        }
      });

    } catch (error) {
      console.error('Error getting emails by account:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve emails for account'
      });
    }
  }

  async getEmailStats(req, res) {
    try {
      const stats = await this.elasticsearchService.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error getting email stats:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve email statistics'
      });
    }
  }

  async getCategories(req, res) {
    try {
      const categories = await this.elasticsearchService.getCategories();

      res.json({
        success: true,
        data: categories
      });

    } catch (error) {
      console.error('Error getting categories:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve categories'
      });
    }
  }

  async getFolders(req, res) {
    try {
      const folders = await this.elasticsearchService.getFolders();

      res.json({
        success: true,
        data: folders
      });

    } catch (error) {
      console.error('Error getting folders:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve folders'
      });
    }
  }

  async deleteEmail(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          error: 'Email ID is required'
        });
      }

      await this.elasticsearchService.deleteEmail(id);

      res.json({
        success: true,
        message: 'Email deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting email:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete email'
      });
    }
  }

  async updateEmailCategory(req, res) {
    try {
      const { id } = req.params;
      const { category } = req.body;

      if (!id) {
        return res.status(400).json({
          error: 'Email ID is required'
        });
      }

      const schema = Joi.object({
        category: Joi.string().valid('Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office').required()
      });

      const { error, value } = schema.validate({ category });
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      await this.elasticsearchService.updateEmailCategory(id, value.category);

      res.json({
        success: true,
        message: 'Email category updated successfully',
        data: { category: value.category }
      });

    } catch (error) {
      console.error('Error updating email category:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update email category'
      });
    }
  }
}

module.exports = EmailRoutes;
