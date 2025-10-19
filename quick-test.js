const axios = require('axios');

console.log('Reachinbox Quick Test');
console.log('========================\n');

async function testApplication() {
  try {
    console.log('1. Testing application startup...');
    
    // Start the application
    const { spawn } = require('child_process');
    const app = spawn('node', ['src/index.js'], { 
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait a bit for startup
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('2. Testing health endpoint...');
    try {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      console.log('Health check passed:', response.data.status);
    } catch (error) {
      console.log('Health check failed:', error.message);
    }

    console.log('3. Testing API endpoints...');
    try {
      const response = await axios.get('http://localhost:3000/api/emails?page=1&size=5', { timeout: 5000 });
      console.log('Email API working:', response.data.success);
    } catch (error) {
      console.log('Email API failed:', error.message);
    }

    console.log('4. Testing AI endpoints...');
    try {
      const response = await axios.get('http://localhost:3000/api/ai/categories', { timeout: 5000 });
      console.log('AI API working:', response.data.success);
    } catch (error) {
      console.log('AI API failed:', error.message);
    }

    // Stop the application
    app.kill();
    console.log('\nQuick test completed!');
    console.log('\nNext steps:');
    console.log('1. Install Docker Desktop');
    console.log('2. Run: docker compose up -d');
    console.log('3. Run: npm start');
    console.log('4. Open: http://localhost:3000');

  } catch (error) {
    console.log('Test failed:', error.message);
  }
}

testApplication();
