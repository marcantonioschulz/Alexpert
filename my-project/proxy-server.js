// Backend Proxy Server für OpenAI Realtime API
// Node.js + Express + WebSocket Proxy

import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// OpenAI API Configuration
const OPENAI_API_KEY = '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';
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Alex Coach Proxy' });
});

// Create WebSocket server for client connections - ES Module fix
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 8080 });

console.log('🚀 Alex Coach Proxy Server starting...');
console.log(`📡 WebSocket Proxy Server listening on port 8080`);
console.log(`🌐 HTTP Server will listen on port ${PORT}`);

wss.on('connection', (clientWs) => {
  console.log('👤 Client connected to proxy');
  
  // Create connection to OpenAI
  const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });
  
  // Forward messages from client to OpenAI
  clientWs.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📤 Client → OpenAI:', data.type);
      
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(message);
      } else {
        console.warn('⚠️ OpenAI WebSocket not ready, queuing message');
      }
    } catch (error) {
      console.error('❌ Error forwarding client message:', error);
    }
  });
  
  // Forward messages from OpenAI to client
  openaiWs.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📥 OpenAI → Client:', data.type);
      
      // Log error details if it's an error message
      if (data.type === 'error') {
        console.error('🚨 OpenAI API Error:', {
          message: data.error?.message,
          code: data.error?.code,
          param: data.error?.param,
          type: data.error?.type
        });
      }
      
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(message);
      }
    } catch (error) {
      console.error('❌ Error forwarding OpenAI message:', error);
    }
  });
  
  // Handle OpenAI connection events
  openaiWs.on('open', () => {
    console.log('🔗 Connected to OpenAI Realtime API');
  });
  
  openaiWs.on('error', (error) => {
    console.error('❌ OpenAI WebSocket error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: {
          message: `OpenAI connection failed: ${error.message}`,
          code: 'connection_error',
          details: error.code
        }
      }));
    }
  });
  
  openaiWs.on('close', () => {
    console.log('🔌 OpenAI connection closed');
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });
  
  // Handle client disconnection
  clientWs.on('close', () => {
    console.log('👋 Client disconnected');
    
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  });
  
  clientWs.on('error', (error) => {
    console.error('❌ Client WebSocket error:', error);
  });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`✅ Alex Coach Proxy Server running on port ${PORT}`);
  console.log(`🔗 WebSocket proxy available at ws://localhost:8080`);
  console.log(`📱 Frontend served at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down proxy server...');
  wss.close();
  process.exit(0);
});