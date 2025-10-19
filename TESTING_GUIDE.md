# 🧪 Reachinbox Testing Guide

## Prerequisites

Before testing, ensure you have:
-  Node.js (v18+) - **INSTALLED**
-  npm - **INSTALLED**
- Docker Desktop - **NEED TO INSTALL**
-  Git - **NEED TO INSTALL**

## Step 1: Install Prerequisites

### Install Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop/
2. Install and restart your computer
3. Open Docker Desktop and ensure it's running

### Install Git (if not installed)
1. Download from: https://git-scm.com/download/win
2. Install with default settings

## Step 2: Start the System

### Option A: With Docker (Recommended)
```bash
# Start all services
docker compose up -d

# Check if services are running
docker compose ps

# View logs
docker compose logs -f
```

### Option B: Without Docker (Limited Testing)
```bash
# Install dependencies
npm install

# Start the application (will show errors for missing services)
npm start
```

## Step 3: Verify Services

### Check Elasticsearch
```bash
# Test Elasticsearch
curl http://localhost:9200

# Expected response:
# {
#   "name" : "reachinbox-elasticsearch",
#   "cluster_name" : "docker-cluster",
#   "cluster_uuid" : "...",
#   "version" : { ... }
# }
```

### Check Qdrant
```bash
# Test Qdrant
curl http://localhost:6333/collections

# Expected response:
# {"result":{"collections":[]}}
```

### Check Application
```bash
# Test application health
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2024-01-15T10:00:00.000Z",
#   "services": {
#     "elasticsearch": true,
#     "imap": false
#   }
# }
```

## Step 4: Configure Environment

1. **Copy environment file:**
   ```bash
   copy env.example .env
   ```

2. **Edit .env file with your settings:**
   ```env
   # Email Configuration
   EMAIL_ACCOUNTS=your-email@gmail.com,another-email@outlook.com
   EMAIL_PASSWORDS=your-app-password,another-app-password
   
   # AI Configuration
   OPENAI_API_KEY=your_openai_api_key
   
   # Slack Configuration (Optional)
   SLACK_WEBHOOK_URL=your_slack_webhook_url
   
   # Webhook Configuration (Optional)
   WEBHOOK_URL=https://webhook.site/your_webhook_id
   ```

3. **For Gmail, enable App Passwords:**
   - Go to Google Account settings
   - Enable 2-Factor Authentication
   - Generate App Password for "Mail"
   - Use the App Password in EMAIL_PASSWORDS

## Step 5: Test Individual Features

### 1. Test Health Endpoint
```bash
curl http://localhost:3000/health
```

### 2. Test Email API
```bash
# Get all emails
curl "http://localhost:3000/api/emails?page=1&size=10"

# Search emails
curl "http://localhost:3000/api/search?q=test&page=1&size=10"
```

### 3. Test AI Categorization
```bash
curl -X POST http://localhost:3000/api/ai/categorize \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-email-123",
    "from": "test@example.com",
    "to": "user@company.com",
    "subject": "Meeting Request",
    "text": "Hi! I would like to schedule a meeting to discuss our project.",
    "date": "2024-01-15T10:00:00Z"
  }'
```

### 4. Test AI Reply Generation
```bash
curl -X POST http://localhost:3000/api/ai/reply/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "id": "email-123",
      "from": "recruiter@company.com",
      "to": "candidate@example.com",
      "subject": "Interview Invitation",
      "text": "Hi! Your resume has been shortlisted. When will be a good time for you to attend the technical interview?",
      "date": "2024-01-15T10:00:00Z"
    },
    "trainingData": "I am applying for a job position. If the lead is interested, share the meeting booking link: https://cal.com/example"
  }'
```

## Step 6: Test Frontend

1. **Open browser:** http://localhost:3000
2. **Expected to see:**
   - Modern email interface
   - Search bar
   - Filter options
   - Email list (empty initially)
   - Real-time connection status

## Step 7: Test Real-Time Features

### Test IMAP Sync (if configured)
1. Send a test email to one of your configured accounts
2. Watch the application logs for new email detection
3. Check the frontend for real-time updates

### Test WebSocket Connection
1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for WebSocket connection messages
4. Send a test email and watch for real-time updates

## Step 8: Test Complete Workflow

### Full Email Processing Pipeline
1. **Send test email** to configured account
2. **Check logs** for IMAP sync
3. **Verify Elasticsearch** indexing
4. **Check AI categorization** result
5. **Verify Slack notification** (if configured)
6. **Test webhook trigger** (if configured)
7. **Check frontend** for new email display

## Troubleshooting

### Common Issues

#### 1. Docker Not Starting
```bash
# Check Docker status
docker --version
docker compose --version

# Restart Docker Desktop
# Check if virtualization is enabled in BIOS
```

#### 2. Port Already in Use
```bash
# Check what's using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <process_id> /F
```

#### 3. Elasticsearch Not Starting
```bash
# Check Docker logs
docker compose logs elasticsearch

# Increase Docker memory allocation
# Restart Docker Desktop
```

#### 4. IMAP Connection Failed
- Check email credentials
- Enable "Less Secure Apps" for Gmail
- Use App Passwords for 2FA accounts
- Check firewall settings

#### 5. AI Services Not Working
- Verify OpenAI API key
- Check API quota and billing
- Review error logs

### Log Files
Check these log files for detailed error information:
- `logs/combined.log` - General application logs
- `logs/error.log` - Error logs
- `logs/imap-sync.log` - IMAP synchronization logs
- `logs/elasticsearch.log` - Elasticsearch logs
- `logs/ai-categorization.log` - AI service logs

## Success Indicators

### System is Working If:
1. **Health endpoint** returns status "healthy"
2. **Elasticsearch** responds with cluster info
3. **Qdrant** responds with collections info
4. **Frontend** loads without errors
5. **WebSocket** connection established
6. **IMAP sync** starts (if configured)
7. **AI categorization** returns valid categories
8. **Search** returns results (after emails are synced)

### System Needs Fixing If:
1. Health endpoint returns errors
2. Services fail to start
3. Frontend shows connection errors
4. IMAP sync fails to connect
5. AI services return errors
6. Search returns no results

## Quick Test Commands

```bash
# Test all services
curl http://localhost:9200 && echo "Elasticsearch OK"
curl http://localhost:6333/collections && echo "Qdrant OK"
curl http://localhost:3000/health && echo "App OK"

# Test API endpoints
curl "http://localhost:3000/api/emails/stats/overview"
curl "http://localhost:3000/api/ai/categories"
```

## Demo Script

For a complete demo, follow this sequence:
1. Start all services
2. Configure email accounts
3. Send test emails
4. Show real-time sync
5. Demonstrate search
6. Show AI categorization
7. Test AI reply generation
8. Show Slack notifications (if configured)

---

**If all tests pass, your Reachinbox system is working perfectly!**
