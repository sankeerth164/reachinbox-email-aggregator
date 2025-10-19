const OpenAI = require('openai');
const winston = require('winston');
const VectorDatabaseService = require('./vectorDatabaseService');

class AICategorizationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.vectorDB = new VectorDatabaseService();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/ai-categorization.log' }),
        new winston.transports.Console()
      ]
    });
    
    this.categories = [
      'Interested',
      'Meeting Booked',
      'Not Interested',
      'Spam',
      'Out of Office'
    ];
  }

  async initialize() {
    await this.vectorDB.initialize();
  }

  async categorizeEmail(emailData) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        this.logger.warn('OpenAI API key not configured, using default category');
        return 'Not Interested';
      }

      const prompt = this.buildCategorizationPrompt(emailData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that categorizes emails based on their content and context. Analyze the email and return one of the following categories: Interested, Meeting Booked, Not Interested, Spam, Out of Office. Only return the category name, nothing else.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.3
      });

      const category = response.choices[0].message.content.trim();
      
      // Validate category
      if (this.categories.includes(category)) {
        this.logger.info(`Email categorized as: ${category} for subject: ${emailData.subject}`);
        return category;
      } else {
        this.logger.warn(`Invalid category returned: ${category}, using default`);
        return 'Not Interested';
      }

    } catch (error) {
      this.logger.error('Error categorizing email:', error);
      return 'Not Interested';
    }
  }

  buildCategorizationPrompt(emailData) {
    return `
Email Details:
From: ${emailData.from}
To: ${emailData.to}
Subject: ${emailData.subject}
Date: ${emailData.date}
Content: ${emailData.text.substring(0, 1000)}...

Please categorize this email into one of the following categories:
- Interested: The email shows genuine interest in a product, service, or opportunity
- Meeting Booked: The email confirms or schedules a meeting, call, or appointment
- Not Interested: The email shows no interest or is a general inquiry
- Spam: The email appears to be spam, promotional, or irrelevant
- Out of Office: The email is an automated out-of-office reply

Category:`;
  }

  async generateSuggestedReply(emailData, trainingData) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        this.logger.warn('OpenAI API key not configured, cannot generate reply');
        return 'AI reply generation not available';
      }

      // Use RAG to find relevant training data
      let relevantContext = '';
      if (this.vectorDB.isInitialized()) {
        const relevantData = await this.vectorDB.findRelevantTrainingData(
          `${emailData.subject} ${emailData.text}`,
          3
        );
        
        if (relevantData.length > 0) {
          relevantContext = relevantData.map(item => item.content).join('\n\n');
        }
      }

      // Combine provided training data with retrieved context
      const combinedTrainingData = trainingData + (relevantContext ? '\n\nRelevant Context:\n' + relevantContext : '');

      const prompt = this.buildReplyPrompt(emailData, combinedTrainingData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that generates professional email replies based on the original email and training data. Generate a helpful, professional, and contextually appropriate reply. Use the provided context and training data to make the reply relevant and personalized.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const suggestedReply = response.choices[0].message.content.trim();
      
      this.logger.info(`Generated suggested reply for email: ${emailData.subject}`);
      return suggestedReply;

    } catch (error) {
      this.logger.error('Error generating suggested reply:', error);
      return 'Error generating reply. Please try again.';
    }
  }

  buildReplyPrompt(emailData, trainingData) {
    return `
Original Email:
From: ${emailData.from}
Subject: ${emailData.subject}
Content: ${emailData.text}

Training Data/Context:
${trainingData}

Please generate a professional and helpful reply to this email based on the training data provided. The reply should be:
- Professional and courteous
- Relevant to the original email content
- Include any relevant information from the training data
- Be concise but complete
- Include any relevant links or next steps if applicable

Suggested Reply:`;
  }

  async batchCategorizeEmails(emails) {
    try {
      const results = [];
      
      for (const email of emails) {
        const category = await this.categorizeEmail(email);
        results.push({
          id: email.id,
          category: category
        });
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logger.info(`Batch categorized ${emails.length} emails`);
      return results;
      
    } catch (error) {
      this.logger.error('Error in batch categorization:', error);
      throw error;
    }
  }

  getCategories() {
    return this.categories;
  }

  async getCategorizationStats() {
    try {
      // This would typically query the database for stats
      // For now, return mock data
      return {
        totalCategorized: 0,
        byCategory: this.categories.reduce((acc, category) => {
          acc[category] = 0;
          return acc;
        }, {})
      };
    } catch (error) {
      this.logger.error('Error getting categorization stats:', error);
      throw error;
    }
  }

  async storeTrainingData(content, category = 'general', metadata = {}) {
    try {
      if (!this.vectorDB.isInitialized()) {
        this.logger.warn('Vector database not initialized, cannot store training data');
        return false;
      }

      const trainingData = {
        id: `training_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content,
        category: category,
        metadata: {
          ...metadata,
          storedAt: new Date().toISOString()
        }
      };

      const success = await this.vectorDB.storeTrainingData(trainingData);
      
      if (success) {
        this.logger.info(`Stored training data: ${trainingData.id}`);
      }
      
      return success;

    } catch (error) {
      this.logger.error('Error storing training data:', error);
      return false;
    }
  }

  async getRelevantTrainingData(query, topK = 5) {
    try {
      if (!this.vectorDB.isInitialized()) {
        this.logger.warn('Vector database not initialized');
        return [];
      }

      return await this.vectorDB.findRelevantTrainingData(query, topK);

    } catch (error) {
      this.logger.error('Error getting relevant training data:', error);
      return [];
    }
  }

  async deleteTrainingData(id) {
    try {
      if (!this.vectorDB.isInitialized()) {
        this.logger.warn('Vector database not initialized');
        return false;
      }

      return await this.vectorDB.deleteTrainingData(id);

    } catch (error) {
      this.logger.error('Error deleting training data:', error);
      return false;
    }
  }

  async getVectorDatabaseStats() {
    try {
      if (!this.vectorDB.isInitialized()) {
        return null;
      }

      return await this.vectorDB.getIndexStats();

    } catch (error) {
      this.logger.error('Error getting vector database stats:', error);
      return null;
    }
  }

  async initializeDefaultTrainingData() {
    try {
      const defaultTrainingData = [
        {
          content: "I am applying for a job position. If the lead is interested, share the meeting booking link: https://cal.com/example",
          category: "job_application",
          metadata: { type: "template", priority: "high" }
        },
        {
          content: "Thank you for your interest in our product. I'd be happy to schedule a demo. Please book a time that works for you: https://cal.com/demo",
          category: "product_demo",
          metadata: { type: "template", priority: "high" }
        },
        {
          content: "I'm available for a technical interview. You can book a slot here: https://cal.com/technical-interview",
          category: "interview",
          metadata: { type: "template", priority: "high" }
        },
        {
          content: "I would love to discuss this opportunity further. Please let me know when you're available for a call.",
          category: "follow_up",
          metadata: { type: "template", priority: "medium" }
        },
        {
          content: "Thank you for considering my application. I'm excited about the possibility of joining your team.",
          category: "gratitude",
          metadata: { type: "template", priority: "medium" }
        }
      ];

      let storedCount = 0;
      for (const data of defaultTrainingData) {
        const success = await this.storeTrainingData(data.content, data.category, data.metadata);
        if (success) storedCount++;
      }

      this.logger.info(`Initialized ${storedCount} default training data entries`);
      return storedCount;

    } catch (error) {
      this.logger.error('Error initializing default training data:', error);
      return 0;
    }
  }
}

module.exports = AICategorizationService;
