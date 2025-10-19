const axios = require('axios');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class SystemTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.elasticsearchUrl = 'http://localhost:9200';
    this.qdrantUrl = 'http://localhost:6333';
    this.tests = [];
  }

  async runTest(name, testFunction) {
    try {
      logger.info(`Running test: ${name}`);
      const result = await testFunction();
      this.tests.push({ name, status: 'PASS', result });
      logger.info(`${name}: PASS`);
      return true;
    } catch (error) {
      this.tests.push({ name, status: 'FAIL', error: error.message });
      logger.error(`${name}: FAIL - ${error.message}`);
      return false;
    }
  }

  async testElasticsearch() {
    const response = await axios.get(this.elasticsearchUrl, { timeout: 5000 });
    if (response.status === 200 && response.data.cluster_name) {
      return { cluster: response.data.cluster_name, version: response.data.version.number };
    }
    throw new Error('Elasticsearch not responding properly');
  }

  async testQdrant() {
    const response = await axios.get(`${this.qdrantUrl}/collections`, { timeout: 5000 });
    if (response.status === 200) {
      return { collections: response.data.result.collections.length };
    }
    throw new Error('Qdrant not responding properly');
  }

  async testApplicationHealth() {
    const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
    if (response.status === 200 && response.data.status === 'healthy') {
      return response.data;
    }
    throw new Error('Application not healthy');
  }

  async testEmailAPI() {
    const response = await axios.get(`${this.baseUrl}/api/emails?page=1&size=5`, { timeout: 5000 });
    if (response.status === 200 && response.data.success) {
      return { 
        totalEmails: response.data.data.pagination.total,
        emailsReturned: response.data.data.emails.length
      };
    }
    throw new Error('Email API not responding');
  }

  async testSearchAPI() {
    const response = await axios.get(`${this.baseUrl}/api/search?q=test&page=1&size=5`, { timeout: 5000 });
    if (response.status === 200 && response.data.success) {
      return { 
        query: response.data.data.search.query,
        results: response.data.data.emails.length
      };
    }
    throw new Error('Search API not responding');
  }

  async testAICategories() {
    const response = await axios.get(`${this.baseUrl}/api/ai/categories`, { timeout: 5000 });
    if (response.status === 200 && response.data.success) {
      return { 
        categories: response.data.data.categories,
        count: response.data.data.count
      };
    }
    throw new Error('AI Categories API not responding');
  }

  async testAICategorization() {
    const testEmail = {
      id: 'test-email-123',
      from: 'test@example.com',
      to: 'user@company.com',
      subject: 'Test Meeting Request',
      text: 'Hi! I would like to schedule a meeting to discuss our project. Are you available next week?',
      date: new Date().toISOString()
    };

    const response = await axios.post(`${this.baseUrl}/api/ai/categorize`, testEmail, { timeout: 10000 });
    if (response.status === 200 && response.data.success && response.data.data.category) {
      return { 
        category: response.data.data.category,
        confidence: response.data.data.confidence
      };
    }
    throw new Error('AI Categorization not working');
  }

  async testAIReplyGeneration() {
    const testData = {
      email: {
        id: 'email-123',
        from: 'recruiter@company.com',
        to: 'candidate@example.com',
        subject: 'Interview Invitation',
        text: 'Hi! Your resume has been shortlisted. When will be a good time for you to attend the technical interview?',
        date: new Date().toISOString()
      },
      trainingData: 'I am applying for a job position. If the lead is interested, share the meeting booking link: https://cal.com/example'
    };

    const response = await axios.post(`${this.baseUrl}/api/ai/reply/suggest`, testData, { timeout: 15000 });
    if (response.status === 200 && response.data.success && response.data.data.suggestedReply) {
      return { 
        replyLength: response.data.data.suggestedReply.length,
        hasCalLink: response.data.data.suggestedReply.includes('cal.com')
      };
    }
    throw new Error('AI Reply Generation not working');
  }

  async testStatsAPI() {
    const response = await axios.get(`${this.baseUrl}/api/emails/stats/overview`, { timeout: 5000 });
    if (response.status === 200 && response.data.success) {
      return response.data.data;
    }
    throw new Error('Stats API not responding');
  }

  async runAllTests() {
    logger.info('Starting Reachinbox System Tests...\n');

    // Core Services Tests
    await this.runTest('Elasticsearch Connection', () => this.testElasticsearch());
    await this.runTest('Qdrant Connection', () => this.testQdrant());
    await this.runTest('Application Health', () => this.testApplicationHealth());

    // API Tests
    await this.runTest('Email API', () => this.testEmailAPI());
    await this.runTest('Search API', () => this.testSearchAPI());
    await this.runTest('Stats API', () => this.testStatsAPI());

    // AI Tests
    await this.runTest('AI Categories', () => this.testAICategories());
    await this.runTest('AI Categorization', () => this.testAICategorization());
    await this.runTest('AI Reply Generation', () => this.testAIReplyGeneration());

    // Summary
    this.printSummary();
  }

  printSummary() {
    logger.info('\nTest Summary:');
    logger.info('================');

    const passed = this.tests.filter(t => t.status === 'PASS').length;
    const failed = this.tests.filter(t => t.status === 'FAIL').length;
    const total = this.tests.length;

    logger.info(`Total Tests: ${total}`);
    logger.info(`Passed: ${passed}`);
    logger.info(`Failed: ${failed}`);
    logger.info(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0) {
      logger.info('\nFailed Tests:');
      this.tests.filter(t => t.status === 'FAIL').forEach(test => {
        logger.info(`  - ${test.name}: ${test.error}`);
      });
    }

    if (passed === total) {
      logger.info('\nAll tests passed! Your Reachinbox system is working perfectly!');
    } else {
      logger.info('\nSome tests failed. Check the error messages above and fix the issues.');
    }

    logger.info('\nNext Steps:');
    logger.info('1. If all tests pass, open http://localhost:3000 in your browser');
    logger.info('2. Configure your email accounts in the .env file');
    logger.info('3. Send test emails to see real-time synchronization');
    logger.info('4. Use the Postman collection to test all API endpoints');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SystemTester();
  tester.runAllTests().catch(error => {
    logger.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = SystemTester;
