const express = require('express');
const Joi = require('joi');

class SearchRoutes {
  constructor(elasticsearchService) {
    this.router = express.Router();
    this.elasticsearchService = elasticsearchService;
    this.setupRoutes();
  }

  setupRoutes() {
    // Search emails
    this.router.get('/', this.searchEmails.bind(this));
    
    // Advanced search with multiple criteria
    this.router.post('/advanced', this.advancedSearch.bind(this));
    
    // Search suggestions/autocomplete
    this.router.get('/suggestions', this.getSearchSuggestions.bind(this));
    
    // Search by specific fields
    this.router.get('/by-field', this.searchByField.bind(this));
  }

  async searchEmails(req, res) {
    try {
      const schema = Joi.object({
        q: Joi.string().allow('').optional(),
        email: Joi.string().email().optional(),
        folder: Joi.string().optional(),
        category: Joi.string().optional(),
        dateFrom: Joi.date().optional(),
        dateTo: Joi.date().optional(),
        page: Joi.number().integer().min(1).default(1),
        size: Joi.number().integer().min(1).max(100).default(20),
        sortBy: Joi.string().valid('date', 'relevance', 'subject', 'from').default('date'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
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
        size: value.size,
        sortBy: value.sortBy,
        sortOrder: value.sortOrder
      };

      const result = await this.elasticsearchService.searchEmails(value.q, filters);

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
          search: {
            query: value.q,
            filters: filters,
            took: result.took
          }
        }
      });

    } catch (error) {
      console.error('Error searching emails:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to search emails'
      });
    }
  }

  async advancedSearch(req, res) {
    try {
      const schema = Joi.object({
        query: Joi.string().allow('').optional(),
        filters: Joi.object({
          from: Joi.string().optional(),
          to: Joi.string().optional(),
          subject: Joi.string().optional(),
          hasAttachments: Joi.boolean().optional(),
          flags: Joi.array().items(Joi.string()).optional(),
          sizeMin: Joi.number().integer().min(0).optional(),
          sizeMax: Joi.number().integer().min(0).optional()
        }).optional(),
        dateRange: Joi.object({
          from: Joi.date().optional(),
          to: Joi.date().optional()
        }).optional(),
        accounts: Joi.array().items(Joi.string().email()).optional(),
        folders: Joi.array().items(Joi.string()).optional(),
        categories: Joi.array().items(Joi.string()).optional(),
        pagination: Joi.object({
          page: Joi.number().integer().min(1).default(1),
          size: Joi.number().integer().min(1).max(100).default(20)
        }).optional(),
        sorting: Joi.object({
          field: Joi.string().valid('date', 'subject', 'from', 'size', 'relevance').default('date'),
          order: Joi.string().valid('asc', 'desc').default('desc')
        }).optional()
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details[0].message
        });
      }

      // Build advanced search query
      const searchQuery = this.buildAdvancedSearchQuery(value);
      const result = await this.elasticsearchService.advancedSearch(searchQuery);

      res.json({
        success: true,
        data: {
          emails: result.hits,
          pagination: {
            page: value.pagination?.page || 1,
            size: value.pagination?.size || 20,
            total: result.total,
            pages: Math.ceil(result.total / (value.pagination?.size || 20))
          },
          search: {
            query: value.query,
            filters: value.filters,
            took: result.took
          }
        }
      });

    } catch (error) {
      console.error('Error in advanced search:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to perform advanced search'
      });
    }
  }

  buildAdvancedSearchQuery(searchParams) {
    const query = {
      bool: {
        must: [],
        filter: []
      }
    };

    // Text search
    if (searchParams.query) {
      query.bool.must.push({
        multi_match: {
          query: searchParams.query,
          fields: ['subject^3', 'from^2', 'to^2', 'text'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    } else {
      query.bool.must.push({ match_all: {} });
    }

    // Field filters
    if (searchParams.filters) {
      const filters = searchParams.filters;
      
      if (filters.from) {
        query.bool.filter.push({
          wildcard: { from: `*${filters.from}*` }
        });
      }
      
      if (filters.to) {
        query.bool.filter.push({
          wildcard: { to: `*${filters.to}*` }
        });
      }
      
      if (filters.subject) {
        query.bool.filter.push({
          wildcard: { subject: `*${filters.subject}*` }
        });
      }
      
      if (filters.hasAttachments !== undefined) {
        if (filters.hasAttachments) {
          query.bool.filter.push({
            exists: { field: 'attachments' }
          });
        } else {
          query.bool.filter.push({
            bool: { must_not: { exists: { field: 'attachments' } } }
          });
        }
      }
      
      if (filters.flags && filters.flags.length > 0) {
        query.bool.filter.push({
          terms: { flags: filters.flags }
        });
      }
      
      if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) {
        const sizeRange = {};
        if (filters.sizeMin !== undefined) sizeRange.gte = filters.sizeMin;
        if (filters.sizeMax !== undefined) sizeRange.lte = filters.sizeMax;
        query.bool.filter.push({
          range: { size: sizeRange }
        });
      }
    }

    // Date range
    if (searchParams.dateRange) {
      const dateRange = {};
      if (searchParams.dateRange.from) dateRange.gte = searchParams.dateRange.from;
      if (searchParams.dateRange.to) dateRange.lte = searchParams.dateRange.to;
      query.bool.filter.push({
        range: { date: dateRange }
      });
    }

    // Account filters
    if (searchParams.accounts && searchParams.accounts.length > 0) {
      query.bool.filter.push({
        terms: { email: searchParams.accounts }
      });
    }

    // Folder filters
    if (searchParams.folders && searchParams.folders.length > 0) {
      query.bool.filter.push({
        terms: { folder: searchParams.folders }
      });
    }

    // Category filters
    if (searchParams.categories && searchParams.categories.length > 0) {
      query.bool.filter.push({
        terms: { category: searchParams.categories }
      });
    }

    return {
      query: query,
      sort: [
        { [searchParams.sorting?.field || 'date']: { order: searchParams.sorting?.order || 'desc' } }
      ],
      size: searchParams.pagination?.size || 20,
      from: ((searchParams.pagination?.page || 1) - 1) * (searchParams.pagination?.size || 20)
    };
  }

  async getSearchSuggestions(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json({
          success: true,
          data: {
            suggestions: []
          }
        });
      }

      // This would typically use Elasticsearch's suggest API
      // For now, return mock suggestions
      const suggestions = [
        `"${q}"`,
        `${q} AND interested`,
        `${q} AND meeting`,
        `from:${q}`,
        `subject:${q}`
      ];

      res.json({
        success: true,
        data: {
          suggestions: suggestions
        }
      });

    } catch (error) {
      console.error('Error getting search suggestions:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get search suggestions'
      });
    }
  }

  async searchByField(req, res) {
    try {
      const schema = Joi.object({
        field: Joi.string().valid('from', 'to', 'subject', 'text').required(),
        value: Joi.string().required(),
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

      const query = {
        wildcard: {
          [value.field]: `*${value.value}*`
        }
      };

      const filters = {
        from: (value.page - 1) * value.size,
        size: value.size
      };

      const result = await this.elasticsearchService.searchEmails(query, filters);

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
          search: {
            field: value.field,
            value: value.value,
            took: result.took
          }
        }
      });

    } catch (error) {
      console.error('Error searching by field:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to search by field'
      });
    }
  }
}

module.exports = SearchRoutes;
