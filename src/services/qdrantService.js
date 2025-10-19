const axios = require('axios');
const winston = require('winston');

class QdrantService {
  constructor() {
    this.baseUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    this.collectionName = process.env.QDRANT_COLLECTION || 'email-vectors';
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/qdrant.log' }),
        new winston.transports.Console()
      ]
    });
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Test connection
      await this.ping();
      
      // Create collection if it doesn't exist
      await this.createCollection();
      
      this.isInitialized = true;
      this.logger.info('Qdrant service initialized successfully');
      return true;

    } catch (error) {
      this.logger.error('Failed to initialize Qdrant service:', error);
      return false;
    }
  }

  async ping() {
    try {
      const response = await axios.get(`${this.baseUrl}/`);
      return response.status === 200;
    } catch (error) {
      this.logger.error('Qdrant ping failed:', error);
      throw error;
    }
  }

  async createCollection() {
    try {
      // Check if collection exists
      const existsResponse = await axios.get(`${this.baseUrl}/collections/${this.collectionName}`);
      if (existsResponse.status === 200) {
        this.logger.info(`Collection ${this.collectionName} already exists`);
        return true;
      }
    } catch (error) {
      // Collection doesn't exist, create it
    }

    try {
      const collectionConfig = {
        vectors: {
          size: 1536, // OpenAI embedding dimension
          distance: 'Cosine'
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      };

      await axios.put(`${this.baseUrl}/collections/${this.collectionName}`, collectionConfig);
      this.logger.info(`Created collection: ${this.collectionName}`);
      return true;

    } catch (error) {
      this.logger.error('Error creating collection:', error);
      throw error;
    }
  }

  async storeVector(id, vector, payload = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Qdrant service not initialized');
      }

      const point = {
        id: id,
        vector: vector,
        payload: {
          ...payload,
          createdAt: new Date().toISOString()
        }
      };

      await axios.put(`${this.baseUrl}/collections/${this.collectionName}/points`, {
        points: [point]
      });

      this.logger.debug(`Stored vector: ${id}`);
      return true;

    } catch (error) {
      this.logger.error('Error storing vector:', error);
      throw error;
    }
  }

  async searchSimilar(queryVector, topK = 5, filter = null) {
    try {
      if (!this.isInitialized) {
        throw new Error('Qdrant service not initialized');
      }

      const searchPayload = {
        vector: queryVector,
        limit: topK,
        with_payload: true,
        with_vector: false
      };

      if (filter) {
        searchPayload.filter = filter;
      }

      const response = await axios.post(
        `${this.baseUrl}/collections/${this.collectionName}/points/search`,
        searchPayload
      );

      return response.data.result.map(point => ({
        id: point.id,
        score: point.score,
        payload: point.payload
      }));

    } catch (error) {
      this.logger.error('Error searching similar vectors:', error);
      throw error;
    }
  }

  async deleteVector(id) {
    try {
      if (!this.isInitialized) {
        throw new Error('Qdrant service not initialized');
      }

      await axios.post(`${this.baseUrl}/collections/${this.collectionName}/points/delete`, {
        points: [id]
      });

      this.logger.debug(`Deleted vector: ${id}`);
      return true;

    } catch (error) {
      this.logger.error('Error deleting vector:', error);
      throw error;
    }
  }

  async deleteCollection() {
    try {
      await axios.delete(`${this.baseUrl}/collections/${this.collectionName}`);
      this.logger.info(`Deleted collection: ${this.collectionName}`);
      return true;

    } catch (error) {
      this.logger.error('Error deleting collection:', error);
      throw error;
    }
  }

  async getCollectionInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/collections/${this.collectionName}`);
      return response.data;

    } catch (error) {
      this.logger.error('Error getting collection info:', error);
      throw error;
    }
  }

  async getCollectionStats() {
    try {
      const response = await axios.get(`${this.baseUrl}/collections/${this.collectionName}/points/count`);
      return {
        points_count: response.data.result.count,
        collection_name: this.collectionName
      };

    } catch (error) {
      this.logger.error('Error getting collection stats:', error);
      throw error;
    }
  }

  async clearCollection() {
    try {
      await axios.post(`${this.baseUrl}/collections/${this.collectionName}/points/delete`, {
        filter: {
          must: []
        }
      });

      this.logger.info('Cleared collection');
      return true;

    } catch (error) {
      this.logger.error('Error clearing collection:', error);
      throw error;
    }
  }

  isReady() {
    return this.isInitialized;
  }
}

module.exports = QdrantService;
