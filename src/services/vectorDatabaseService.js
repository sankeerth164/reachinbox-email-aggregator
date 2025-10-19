const QdrantService = require('./qdrantService');
const winston = require('winston');

class VectorDatabaseService {
  constructor() {
    this.qdrant = new QdrantService();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/vector-db.log' }),
        new winston.transports.Console()
      ]
    });
  }

  async initialize() {
    try {
      return await this.qdrant.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize vector database:', error);
      return false;
    }
  }

  async storeTrainingData(data) {
    try {
      if (!this.qdrant.isReady()) {
        this.logger.warn('Vector database not initialized');
        return false;
      }

      const vector = await this.generateEmbedding(data.content);
      
      const vectorId = data.id || `training_${Date.now()}`;
      const payload = {
        type: 'training_data',
        content: data.content,
        category: data.category || 'general',
        ...data.metadata
      };

      await this.qdrant.storeVector(vectorId, vector, payload);
      
      this.logger.info(`Stored training data: ${vectorId}`);
      return true;

    } catch (error) {
      this.logger.error('Error storing training data:', error);
      return false;
    }
  }

  async searchSimilarContent(query, topK = 5) {
    try {
      if (!this.qdrant.isReady()) {
        this.logger.warn('Vector database not initialized');
        return [];
      }

      const queryVector = await this.generateEmbedding(query);
      
      const results = await this.qdrant.searchSimilar(queryVector, topK, {
        must: [
          {
            key: 'type',
            match: { value: 'training_data' }
          }
        ]
      });

      return results.map(result => ({
        id: result.id,
        score: result.score,
        content: result.payload.content,
        category: result.payload.category,
        metadata: result.payload
      }));

    } catch (error) {
      this.logger.error('Error searching similar content:', error);
      return [];
    }
  }

  async generateEmbedding(text) {
    try {
      // For this implementation, we'll use a simple text embedding
      // In production, you would use OpenAI's embedding API or another embedding service
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;

    } catch (error) {
      this.logger.error('Error generating embedding:', error);
      // Fallback to a simple hash-based embedding
      return this.generateSimpleEmbedding(text);
    }
  }

  generateSimpleEmbedding(text) {
    // Simple hash-based embedding for fallback
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(1536).fill(0);
    
    words.forEach(word => {
      const hash = this.simpleHash(word);
      const index = hash % 1536;
      embedding[index] += 1;
    });
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async storeEmailContext(emailId, content, category = 'general') {
    try {
      if (!this.qdrant.isReady()) {
        this.logger.warn('Vector database not initialized');
        return false;
      }

      const vector = await this.generateEmbedding(content);
      
      const vectorId = `email_${emailId}`;
      const payload = {
        type: 'email_context',
        emailId: emailId,
        content: content,
        category: category
      };

      await this.qdrant.storeVector(vectorId, vector, payload);
      
      this.logger.info(`Stored email context: ${emailId}`);
      return true;

    } catch (error) {
      this.logger.error('Error storing email context:', error);
      return false;
    }
  }

  async findRelevantTrainingData(emailContent, topK = 3) {
    try {
      const similarContent = await this.searchSimilarContent(emailContent, topK);
      
      return similarContent.map(item => ({
        content: item.content,
        category: item.category,
        relevanceScore: item.score
      }));

    } catch (error) {
      this.logger.error('Error finding relevant training data:', error);
      return [];
    }
  }

  async deleteTrainingData(id) {
    try {
      if (!this.qdrant.isReady()) {
        this.logger.warn('Vector database not initialized');
        return false;
      }

      await this.qdrant.deleteVector(id);
      
      this.logger.info(`Deleted training data: ${id}`);
      return true;

    } catch (error) {
      this.logger.error('Error deleting training data:', error);
      return false;
    }
  }

  async getIndexStats() {
    try {
      if (!this.qdrant.isReady()) {
        return null;
      }

      const stats = await this.qdrant.getCollectionStats();
      return stats;

    } catch (error) {
      this.logger.error('Error getting index stats:', error);
      return null;
    }
  }

  async clearAllData() {
    try {
      if (!this.qdrant.isReady()) {
        this.logger.warn('Vector database not initialized');
        return false;
      }

      await this.qdrant.clearCollection();
      
      this.logger.info('Cleared all vector data');
      return true;

    } catch (error) {
      this.logger.error('Error clearing all data:', error);
      return false;
    }
  }

  isInitialized() {
    return this.qdrant.isReady();
  }
}

module.exports = VectorDatabaseService;
