// Simple API Key Server für OpenAI Realtime API
// Stellt ephemere API-Schlüssel für Frontend bereit

import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// OpenAI API Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate API key
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

console.log('✅ API key loaded from environment variables');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

console.log('🚀 Alex Coach API Server starting...');

// Ephemeral Key endpoint für Realtime API (wie im Quickstart Guide)
app.get('/api/openai-key', async (req, res) => {
  const timestamp = new Date().toISOString();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  console.log(`🔑 [${timestamp}] [${requestId}] Ephemeral key requested from: ${req.ip}`);
  console.log(`🔑 [${requestId}] User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
  console.log(`🔑 [${requestId}] Headers: ${JSON.stringify(req.headers).substring(0, 100)}...`);
  
  try {
    console.log(`🌐 [${requestId}] Calling OpenAI client_secrets endpoint...`);
    
    // Generate ephemeral client key according to OpenAI docs
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime'
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const keyPreview = data.value?.substring(0, 15) + '...';
      console.log(`✅ [${requestId}] Ephemeral key generated successfully: ${keyPreview}`);
      
      res.json({ 
        apiKey: data.value, // This is the "ek_" key
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 Stunde
      });
    } else {
      const errorText = await response.text();
      console.error(`❌ [${requestId}] Failed to generate ephemeral key:`, response.status, errorText);
      res.status(500).json({ 
        error: 'Failed to generate ephemeral key', 
        details: errorText 
      });
    }
  } catch (error) {
    console.error(`❌ [${requestId}] Ephemeral key generation error:`, error);
    res.status(500).json({ 
      error: 'Server error generating ephemeral key', 
      details: error.message 
    });
  }
});

// Emergency endpoint to reset everything
app.get('/api/emergency-reset', (req, res) => {
  console.log('🚨 EMERGENCY RESET requested from:', req.ip);
  res.json({ 
    status: 'EMERGENCY_RESET', 
    message: 'All sessions should be killed by frontend',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Alex Coach API Server',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Alex Coach API Server running on port ${PORT}`);
  console.log(`🔗 API available at http://localhost:${PORT}/api/openai-key`);
  console.log(`📱 Frontend served at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down API server...');
  process.exit(0);
});