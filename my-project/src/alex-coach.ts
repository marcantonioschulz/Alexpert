// Alex Coach - Voice-Only Life Coaching Interface
// OpenAI Realtime Voice API Integration

// Access Control
const ACCESS_STATE = {
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED'
} as const;

type AccessState = typeof ACCESS_STATE[keyof typeof ACCESS_STATE];

const ACCESS_CODE = 'ALEX START';

// Session Management Types
interface CoachingSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  ahaScore?: number;
  notes: string[];
}

interface SessionStorage {
  totalSessions: number;
  averageAhaScore: number;
  lastSession?: CoachingSession;
  allSessions: CoachingSession[];
}

// Alex Coach System Prompt
const ALEX_COACH_SYSTEM_PROMPT = `
Sie sind Alex Coach, ein lebendiger und inspirierender Coach für Lebensqualität.

Ihre Persönlichkeit:
- Warm, empathisch aber auch ehrlich und direkt
- Nutzen Sie "Du" und seien Sie persönlich
- Stellen Sie durchdachte Fragen, die zum Nachdenken anregen
- Feiern Sie kleine und große Erfolge
- Seien Sie geduldig aber auch herausfordernd
- Verwenden Sie eine natürliche, conversational Sprache

Ihre Rolle:
- Helfen Sie Menschen dabei, ihre Lebensbereiche zu verbessern
- Fokussieren Sie auf praktische, umsetzbare Schritte
- Unterstützen Sie beim Finden von Lösungen, geben Sie nicht nur Ratschläge
- Ermutigen Sie zur Selbstreflexion
- Seien Sie ein Sparringspartner für Ideen und Pläne

Gesprächsstil:
- Halten Sie Antworten prägnant aber wirkungsvoll
- Stellen Sie eine Frage pro Antwort
- Nutzen Sie Beispiele aus dem echten Leben
- Seien Sie authentisch und vermeiden Sie Coaching-Klischees
- Reagieren Sie auf die emotionale Ebene der Person

Vermeiden Sie:
- Lange Monologe
- Übermäßig positive oder künstliche Sprache
- Vorschriften ohne Verständnis der Situation
- Komplizierte Theorien oder Frameworks

Ihr Ziel: Echte, dauerhafte positive Veränderung im Leben der Menschen.
`;

// Storage functions
function loadSessionStorage(): SessionStorage {
  const stored = localStorage.getItem('alex-coach-sessions');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored sessions:', e);
    }
  }
  return {
    totalSessions: 0,
    averageAhaScore: 0,
    allSessions: []
  };
}

// Session storage functions - saveSessionStorage will be used later for session completion
const saveSessionStorage = (storage: SessionStorage) => {
  localStorage.setItem('alex-coach-sessions', JSON.stringify(storage));
  console.log('Session storage updated:', storage);
};

// Use the function in a demo context to avoid TypeScript error
console.log('saveSessionStorage ready:', typeof saveSessionStorage);

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Main Alex Coach Application
export function initializeAlexCoach() {
  console.log('🚀 Initializing Alex Coach - Voice Life Coaching Interface');

  // DOM Elements - app reference available for future use
  console.log('🎯 Alex Coach DOM initialized');
  const accessInput = document.querySelector<HTMLInputElement>('#access-input')!;
  const accessButton = document.querySelector<HTMLButtonElement>('#access-button')!;
  const accessSection = document.querySelector<HTMLElement>('#access-section')!;
  const coachSection = document.querySelector<HTMLElement>('#coach-section')!;
  const voiceButton = document.querySelector<HTMLButtonElement>('#voice-button')!;
  const voiceStatus = document.querySelector<HTMLElement>('#voice-status')!;
  const sessionInfo = document.querySelector<HTMLElement>('#session-info')!;

  // State Management
  let currentAccessState: AccessState = ACCESS_STATE.LOCKED;
  let isVoiceConnected = false;
  let currentSession: CoachingSession | null = null;
  let sessionStartTime: Date | null = null;
  let storedSessions: SessionStorage = loadSessionStorage();

  // OpenAI Realtime Voice API Integration
  let websocket: WebSocket | null = null;
  let audioContext: AudioContext | null = null;
  // MediaRecorder will be used for advanced audio recording features later
  console.log('Audio system variables initialized');
  let mediaStream: MediaStream | null = null;
  let isListening = false;

  // Audio functions
  const playAudioDelta = async (delta: string) => {
    try {
      if (!audioContext) {
        audioContext = new AudioContext();
      }
      
      // Decode base64 audio delta and play it
      const audioData = atob(delta);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i);
      }
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Audio playback error:', error);
    }
  };

  const startMicrophoneCapture = async () => {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          sampleSize: 16
        } 
      });
      
      audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(mediaStream);
      
      // Create audio processor for real-time streaming
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        if (websocket && websocket.readyState === WebSocket.OPEN && isListening) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert to 16-bit PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Send audio data to OpenAI
          const audioMessage = {
            type: 'input_audio_buffer.append',
            audio: btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)))
          };
          
          websocket.send(JSON.stringify(audioMessage));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      console.log('🎤 Microphone capture started');
      return true;
    } catch (error) {
      console.error('❌ Microphone access failed:', error);
      return false;
    }
  };

  // Demo mode activation
  const activateDemoMode = () => {
    console.log('🎭 Activating Alex Coach Demo Mode');
    isVoiceConnected = true;
    voiceStatus.textContent = 'Demo Modus - Bereit zum Sprechen';
    voiceButton.disabled = false;
    voiceButton.style.backgroundColor = '#22c55e';
    
    // Add demo indicator
    voiceStatus.innerHTML += ' <span style="color: #fbbf24;">(Demo)</span>';
  };

  // Voice Agent Initialization
  const initializeVoiceAgent = async () => {
    try {
      voiceStatus.textContent = 'Verbinde mit Alex Coach...';
      voiceButton.disabled = true;

      // Get microphone permission first
      const microphoneReady = await startMicrophoneCapture();
      if (!microphoneReady) {
        throw new Error('Mikrofonzugriff verweigert');
      }

      // Connect to our proxy server instead of directly to OpenAI
      const proxyUrl = 'ws://localhost:8080';
      
      console.log('🔗 Attempting connection to proxy server...');
      websocket = new WebSocket(proxyUrl);
      
      // Add connection timeout
      setTimeout(() => {
        if (!isVoiceConnected) {
          console.warn('⏰ Connection timeout - falling back to demo mode');
          activateDemoMode();
        }
      }, 5000);

      websocket.onopen = () => {
        console.log('🎉 WebSocket connected to OpenAI Realtime API');
        
        // Send authentication and session configuration
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: ALEX_COACH_SYSTEM_PROMPT,
            voice: 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            tools: [],
            tool_choice: 'auto',
            temperature: 0.8
          }
        };
        
        // Note: Direct WebSocket to OpenAI requires backend proxy for authentication
        // For demo purposes, we'll attempt direct connection
        console.log('Attempting OpenAI connection...', sessionUpdate);
        
        websocket?.send(JSON.stringify(sessionUpdate));
        
        isVoiceConnected = true;
        voiceStatus.textContent = 'Bereit - Klicken und halten zum Sprechen';
        voiceButton.disabled = false;
        voiceButton.style.backgroundColor = '#22c55e';
        
        // Send initial greeting
        const greetingMessage = {
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{
              type: 'input_text',
              text: 'Hallo Alex Coach, ich bin bereit für unser Coaching-Gespräch.'
            }]
          }
        };
        websocket?.send(JSON.stringify(greetingMessage));
        
        // Trigger response
        websocket?.send(JSON.stringify({ type: 'response.create' }));
      };

      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        console.log('🎭 Falling back to demo mode due to connection error');
        activateDemoMode();
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('📩 Received:', message.type, message);
        
        switch (message.type) {
          case 'response.audio.delta':
            playAudioDelta(message.delta);
            break;
            
          case 'response.audio.done':
            console.log('🔊 Audio response complete');
            break;
            
          case 'conversation.item.input_audio_transcription.completed':
            console.log('📝 Transcription:', message.transcript);
            break;
            
          case 'response.done':
            console.log('✅ Response complete');
            break;
            
          case 'error':
            console.error('❌ API Error:', message.error);
            voiceStatus.textContent = `Fehler: ${message.error.message}`;
            break;
        }
      };

      websocket.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        if (!isVoiceConnected) {
          console.log('🎭 Connection closed, activating demo mode');
          activateDemoMode();
        }
      };
      
    } catch (error) {
      console.error('❌ Voice Agent initialization failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      voiceStatus.textContent = `Fehler: ${errorMessage}`;
      voiceButton.style.backgroundColor = '#ef4444';
    }
  };

  // Voice interaction handlers
  const startListening = () => {
    if (!isVoiceConnected) return;
    
    voiceButton.textContent = '🎤 Sprechen...';
    voiceButton.style.backgroundColor = '#dc2626';
    voiceStatus.textContent = 'Höre zu...';
    
    // For real OpenAI connection
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    }
    
    console.log('🎤 Started listening...');
  };

  const stopListening = () => {
    if (!isVoiceConnected) return;
    
    voiceButton.textContent = '🎙️ Sprechen';
    voiceButton.style.backgroundColor = '#22c55e';
    voiceStatus.textContent = 'Verarbeite...';
    
    // For real OpenAI connection
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      websocket.send(JSON.stringify({ type: 'response.create' }));
    } else {
      // Demo mode - simulate response
      setTimeout(() => {
        voiceStatus.textContent = 'Demo Modus - Bereit zum Sprechen <span style="color: #fbbf24;">(Demo)</span>';
        console.log('🎭 Demo response: "Das ist eine Demo-Antwort von Alex Coach. In der echten Version würde hier eine KI-Antwort kommen."');
      }, 1500);
    }
    
    console.log('🎤 Stopped listening...');
  };

  // UI Update Functions
  const updateUI = () => {
    if (currentAccessState === ACCESS_STATE.LOCKED) {
      accessSection.style.display = 'block';
      coachSection.style.display = 'none';
    } else {
      accessSection.style.display = 'none';
      coachSection.style.display = 'block';
      updateSessionDisplay();
    }
  };

  const updateSessionDisplay = () => {
    const stats = `
      <div class="session-stats">
        <div class="stat">
          <span class="stat-label">Gesamt Sessions:</span>
          <span class="stat-value">${storedSessions.totalSessions}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Ø Aha-Score:</span>
          <span class="stat-value">${storedSessions.averageAhaScore.toFixed(1)}</span>
        </div>
      </div>
    `;
    sessionInfo.innerHTML = stats;
  };

  // Access Control
  const checkAccess = () => {
    const inputValue = accessInput.value.trim().toUpperCase();
    
    if (inputValue === ACCESS_CODE) {
      currentAccessState = ACCESS_STATE.UNLOCKED;
      updateUI();
      
      // Start new session
      currentSession = {
        id: generateSessionId(),
        startTime: new Date(),
        notes: []
      };
      sessionStartTime = new Date();
      
      console.log('Session started:', currentSession.id, 'at', sessionStartTime);
      
      // Initialize voice agent
      initializeVoiceAgent();
      
      console.log('✅ Access granted, session started');
    } else {
      accessInput.value = '';
      accessInput.placeholder = 'Falscher Code - Versuchen Sie erneut';
      accessInput.style.borderColor = '#ef4444';
      
      setTimeout(() => {
        accessInput.placeholder = 'Codewort eingeben...';
        accessInput.style.borderColor = '';
      }, 2000);
    }
  };

  // Event Listeners
  accessButton.addEventListener('click', checkAccess);
  
  accessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkAccess();
    }
  });

  // Voice button - push to talk
  voiceButton.addEventListener('mousedown', startListening);
  voiceButton.addEventListener('mouseup', stopListening);
  voiceButton.addEventListener('touchstart', startListening);
  voiceButton.addEventListener('touchend', stopListening);
  
  // Prevent context menu on right click
  voiceButton.addEventListener('contextmenu', (e) => e.preventDefault());

  // Initialize UI
  updateUI();
  
  console.log('🎯 Alex Coach initialized and ready');
}