const { Client } = require('@elastic/elasticsearch');
const winston = require('winston');

class ElasticsearchService {
  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    });
    this.indexName = process.env.ELASTICSEARCH_INDEX || 'emails';
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/elasticsearch.log' }),
        new winston.transports.Console()
      ]
    });
    this.isConnected = false;
  }

  async initialize() {
    try {
      // Test connection
      await this.client.ping();
      this.logger.info('Connected to Elasticsearch');
      this.isConnected = true;

      // Create index if it doesn't exist
      await this.createIndex();
      
      // Setup mappings
      await this.setupMappings();

    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch:', error);
      throw error;
    }
  }

  async createIndex() {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  email_analyzer: {
                    type: 'custom',
                    tokenizer: 'standard',
                    filter: ['lowercase', 'stop', 'snowball']
                  }
                }
              }
            }
          }
        });
        this.logger.info(`Created Elasticsearch index: ${this.indexName}`);
      } else {
        this.logger.info(`Elasticsearch index already exists: ${this.indexName}`);
      }
    } catch (error) {
      this.logger.error('Error creating Elasticsearch index:', error);
      throw error;
    }
  }

  async setupMappings() {
    try {
      await this.client.indices.putMapping({
        index: this.indexName,
        body: {
          properties: {
            id: { type: 'keyword' },
            uid: { type: 'long' },
            email: { type: 'keyword' },
            from: { 
              type: 'text',
              analyzer: 'email_analyzer',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            to: { 
              type: 'text',
              analyzer: 'email_analyzer',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            subject: { 
              type: 'text',
              analyzer: 'email_analyzer',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            text: { 
              type: 'text',
              analyzer: 'email_analyzer'
            },
            html: { type: 'text' },
            date: { type: 'date' },
            folder: { type: 'keyword' },
            category: { type: 'keyword' },
            flags: { type: 'keyword' },
            size: { type: 'long' },
            messageId: { type: 'keyword' },
            inReplyTo: { type: 'keyword' },
            references: { type: 'keyword' },
            attachments: {
              type: 'nested',
              properties: {
                filename: { type: 'keyword' },
                contentType: { type: 'keyword' },
                size: { type: 'long' }
              }
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' }
          }
        }
      });
      this.logger.info('Elasticsearch mappings configured');
    } catch (error) {
      this.logger.error('Error setting up Elasticsearch mappings:', error);
      throw error;
    }
  }

  async indexEmail(emailData) {
    try {
      const response = await this.client.index({
        index: this.indexName,
        id: emailData.id,
        body: emailData
      });
      
      this.logger.debug(`Indexed email: ${emailData.id}`);
      return response;
    } catch (error) {
      this.logger.error('Error indexing email:', error);
      throw error;
    }
  }

  async updateEmailCategory(emailId, category) {
    try {
      await this.client.update({
        index: this.indexName,
        id: emailId,
        body: {
          doc: {
            category: category,
            updatedAt: new Date()
          }
        }
      });
      
      this.logger.debug(`Updated email category: ${emailId} -> ${category}`);
    } catch (error) {
      this.logger.error('Error updating email category:', error);
      throw error;
    }
  }

  async searchEmails(query, filters = {}) {
    try {
      const searchBody = {
        query: {
          bool: {
            must: []
          }
        },
        sort: [
          { date: { order: 'desc' } }
        ],
        size: filters.size || 50,
        from: filters.from || 0
      };

      // Add text search
      if (query) {
        searchBody.query.bool.must.push({
          multi_match: {
            query: query,
            fields: ['subject^3', 'from^2', 'to^2', 'text'],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
      } else {
        searchBody.query.bool.must.push({ match_all: {} });
      }

      // Add filters
      if (filters.email) {
        searchBody.query.bool.filter = searchBody.query.bool.filter || [];
        searchBody.query.bool.filter.push({
          term: { email: filters.email }
        });
      }

      if (filters.folder) {
        searchBody.query.bool.filter = searchBody.query.bool.filter || [];
        searchBody.query.bool.filter.push({
          term: { folder: filters.folder }
        });
      }

      if (filters.category) {
        searchBody.query.bool.filter = searchBody.query.bool.filter || [];
        searchBody.query.bool.filter.push({
          term: { category: filters.category }
        });
      }

      if (filters.dateFrom || filters.dateTo) {
        searchBody.query.bool.filter = searchBody.query.bool.filter || [];
        const dateRange = {};
        if (filters.dateFrom) dateRange.gte = filters.dateFrom;
        if (filters.dateTo) dateRange.lte = filters.dateTo;
        searchBody.query.bool.filter.push({
          range: { date: dateRange }
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: searchBody
      });

      return {
        hits: response.body.hits.hits.map(hit => ({
          ...hit._source,
          _score: hit._score
        })),
        total: response.body.hits.total.value,
        took: response.body.took
      };

    } catch (error) {
      this.logger.error('Error searching emails:', error);
      throw error;
    }
  }

  async getEmailById(emailId) {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: emailId
      });

      return response.body._source;
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      this.logger.error('Error getting email by ID:', error);
      throw error;
    }
  }

  async getEmailsByAccount(email) {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            term: { email: email }
          },
          sort: [{ date: { order: 'desc' } }],
          size: 1000
        }
      });

      return response.body.hits.hits.map(hit => hit._source);
    } catch (error) {
      this.logger.error('Error getting emails by account:', error);
      throw error;
    }
  }

  async getCategories() {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          aggs: {
            categories: {
              terms: {
                field: 'category',
                size: 10
              }
            }
          },
          size: 0
        }
      });

      return response.body.aggregations.categories.buckets.map(bucket => ({
        category: bucket.key,
        count: bucket.doc_count
      }));
    } catch (error) {
      this.logger.error('Error getting categories:', error);
      throw error;
    }
  }

  async getFolders() {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          aggs: {
            folders: {
              terms: {
                field: 'folder',
                size: 20
              }
            }
          },
          size: 0
        }
      });

      return response.body.aggregations.folders.buckets.map(bucket => ({
        folder: bucket.key,
        count: bucket.doc_count
      }));
    } catch (error) {
      this.logger.error('Error getting folders:', error);
      throw error;
    }
  }

  async deleteEmail(emailId) {
    try {
      await this.client.delete({
        index: this.indexName,
        id: emailId
      });
      
      this.logger.info(`Deleted email: ${emailId}`);
    } catch (error) {
      this.logger.error('Error deleting email:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          aggs: {
            total_emails: {
              value_count: {
                field: 'id'
              }
            },
            by_account: {
              terms: {
                field: 'email',
                size: 10
              }
            },
            by_category: {
              terms: {
                field: 'category',
                size: 10
              }
            },
            by_folder: {
              terms: {
                field: 'folder',
                size: 10
              }
            }
          },
          size: 0
        }
      });

      return {
        totalEmails: response.body.aggregations.total_emails.value,
        byAccount: response.body.aggregations.by_account.buckets,
        byCategory: response.body.aggregations.by_category.buckets,
        byFolder: response.body.aggregations.by_folder.buckets
      };
    } catch (error) {
      this.logger.error('Error getting stats:', error);
      throw error;
    }
  }

  isConnected() {
    return this.isConnected;
  }
}

module.exports = ElasticsearchService;
