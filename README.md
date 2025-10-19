# Reachinbox - Advanced Email Aggregator

A comprehensive email aggregation system with AI-powered features, real-time synchronization, and advanced search capabilities.

## Features

### ✅ Core Features Implemented

1. **Real-Time Email Synchronization**
   - Sync multiple IMAP accounts in real-time (minimum 2)
   - Fetch last 30 days of emails
   - Persistent IMAP connections with IDLE mode
   - No cron jobs - true real-time updates

2. **Searchable Storage with Elasticsearch**
   - Locally hosted Elasticsearch instance (Docker)
   - Full-text search with advanced filtering
   - Filter by folder, account, category, and date range
   - Optimized indexing for fast searches

3. **AI-Based Email Categorization**
   - Automatic categorization into 5 categories:
     - Interested
     - Meeting Booked
     - Not Interested
     - Spam
     - Out of Office
   - OpenAI GPT-3.5-turbo integration
   - Batch categorization support

4. **Slack & Webhook Integration**
   - Slack notifications for "Interested" emails
   - Webhook triggers for external automation
   - Configurable notification templates
   - Error monitoring and alerts

5. **Frontend Interface**
   - Modern, responsive web interface
   - Real-time email updates via WebSocket
   - Advanced filtering and search
   - Email categorization display
   - Pagination and sorting

6. **AI-Powered Suggested Replies** 🎯
   - RAG (Retrieval-Augmented Generation) implementation
   - Vector database integration (Pinecone)
   - Context-aware reply suggestions
   - Training data integration

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   IMAP Sync     │    │   Elasticsearch  │    │   Frontend UI   │
│   Service       │◄──►│   (Search &      │◄──►│   (React-like   │
│   (Real-time)   │    │    Storage)      │    │    Vanilla JS)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Service    │    │   Vector DB      │    │   WebSocket     │
│   (OpenAI)      │    │   (Pinecone)     │    │   (Real-time)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   Slack &       │    │   Webhook        │
│   Notifications │    │   Integration    │
└─────────────────┘    └──────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- OpenAI API key
- Pinecone API key (for AI replies)
- IMAP email accounts (Gmail, Outlook, etc.)

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd reachinbox-onebox
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start Services**
   ```bash
   # Start Elasticsearch and Kibana
   docker-compose up -d elasticsearch kibana
   
   # Start the application
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - API Health: http://localhost:3000/health
   - Kibana: http://localhost:5601

## Configuration

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# IMAP Configuration
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
EMAIL_ACCOUNTS=user1@gmail.com,user2@outlook.com
EMAIL_PASSWORDS=password1,password2

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=emails

# AI Services
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment
PINECONE_INDEX_NAME=email-vectors

# Notifications
SLACK_WEBHOOK_URL=your_slack_webhook_url
WEBHOOK_URL=https://webhook.site/your_webhook_id

# Security
JWT_SECRET=your_jwt_secret
```

## API Endpoints

### Email Management
- `GET /api/emails` - List emails with filtering and pagination
- `GET /api/emails/:id` - Get specific email
- `GET /api/emails/account/:email` - Get emails by account
- `DELETE /api/emails/:id` - Delete email
- `PATCH /api/emails/:id/category` - Update email category

### Search
- `GET /api/search` - Search emails
- `POST /api/search/advanced` - Advanced search with multiple criteria
- `GET /api/search/suggestions` - Get search suggestions

### AI Features
- `POST /api/ai/categorize` - Categorize single email
- `POST /api/ai/categorize/batch` - Batch categorize emails
- `POST /api/ai/reply/suggest` - Generate suggested reply
- `GET /api/ai/categories` - Get available categories
- `GET /api/ai/stats` - Get categorization statistics

### Statistics
- `GET /api/emails/stats/overview` - Get email statistics
- `GET /api/emails/stats/categories` - Get category breakdown
- `GET /api/emails/stats/folders` - Get folder breakdown

## Features in Detail

### Real-Time Email Sync

The IMAP sync service maintains persistent connections to email servers using IDLE mode for real-time updates:

```javascript
// Automatic real-time sync
const imapSyncService = new ImapSyncService(
  elasticsearchService,
  aiCategorizationService,
  slackService,
  webhookService,
  io
);
```

### AI Categorization

Emails are automatically categorized using OpenAI's GPT-3.5-turbo:

```javascript
const category = await aiCategorizationService.categorizeEmail({
  from: 'sender@example.com',
  subject: 'Meeting Request',
  text: 'Would you like to schedule a call?',
  // ... other fields
});
// Returns: 'Interested', 'Meeting Booked', 'Not Interested', 'Spam', or 'Out of Office'
```

### Advanced Search

Powerful search capabilities with Elasticsearch:

```javascript
// Search with filters
const results = await elasticsearchService.searchEmails('meeting', {
  category: 'Interested',
  dateFrom: '2024-01-01',
  dateTo: '2024-12-31',
  email: 'user@gmail.com'
});
```

### AI-Powered Replies

Generate context-aware replies using RAG:

```javascript
const suggestedReply = await aiCategorizationService.generateSuggestedReply(
  emailData,
  'I am applying for a job position. If interested, share: https://cal.com/example'
);
```

## Testing with Postman

Import the provided Postman collection to test all API endpoints:

1. **Health Check**
   ```
   GET http://localhost:3000/health
   ```

2. **Search Emails**
   ```
   GET http://localhost:3000/api/emails?query=meeting&category=Interested
   ```

3. **AI Categorization**
   ```
   POST http://localhost:3000/api/ai/categorize
   {
     "id": "test-123",
     "from": "sender@example.com",
     "subject": "Meeting Request",
     "text": "Would you like to schedule a call?",
     "date": "2024-01-15T10:00:00Z"
   }
   ```

4. **Generate AI Reply**
   ```
   POST http://localhost:3000/api/ai/reply/suggest
   {
     "email": { /* email object */ },
     "trainingData": "I am applying for a job position..."
   }
   ```

## Docker Deployment

### Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale services
docker-compose up -d --scale app=3
```

### Development

```bash
# Start only Elasticsearch
docker-compose up -d elasticsearch

# Run app locally
npm run dev
```

## Monitoring and Logs

- **Application Logs**: `logs/combined.log`
- **Error Logs**: `logs/error.log`
- **IMAP Sync Logs**: `logs/imap-sync.log`
- **Elasticsearch Logs**: `logs/elasticsearch.log`
- **AI Service Logs**: `logs/ai-categorization.log`

## Performance

- **Email Sync**: Real-time with < 1 second latency
- **Search**: Sub-second response times with Elasticsearch
- **AI Processing**: 2-5 seconds per email categorization
- **Concurrent Users**: Supports 100+ concurrent WebSocket connections

## Security

- Environment variable configuration
- Input validation with Joi
- CORS protection
- Helmet security headers
- Rate limiting (configurable)

## Troubleshooting

### Common Issues

1. **IMAP Connection Failed**
   - Check email credentials
   - Enable "Less Secure Apps" for Gmail
   - Use App Passwords for 2FA accounts

2. **Elasticsearch Not Starting**
   - Ensure Docker is running
   - Check port 9200 is available
   - Increase Docker memory allocation

3. **AI Categorization Not Working**
   - Verify OpenAI API key
   - Check API quota and billing
   - Review error logs

4. **WebSocket Connection Issues**
   - Check firewall settings
   - Verify port 3000 is accessible
   - Review browser console for errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

ISC License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the logs for error details

---

**Built with for the Reachinbox challenge**
