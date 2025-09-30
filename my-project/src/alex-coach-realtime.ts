// Alex Coach - Nach offizieller OpenAI Agents Realtime Quickstart Guide
// Echte Voice AI mit korrekten ephemeral keys

import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';

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

// Global session state
let currentSession: CoachingSession | null = null;

function loadSessionStorage(): SessionStorage {
  const stored = localStorage.getItem('alex-coach-sessions');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      data.allSessions = data.allSessions.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : undefined
      }));
      return data;
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

const saveSessionStorage = (storage: SessionStorage) => {
  localStorage.setItem('alex-coach-sessions', JSON.stringify(storage));
  console.log('💾 Session data saved');
};

// Use the function to avoid unused warning
saveSessionStorage;

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Session ID Generator for tracking
let sessionCounter = 0;
function generateSessionTrackingId(): string {
  return `SESSION_${++sessionCounter}_${Date.now()}`;
}

// Global session tracking
const activeSessions = new Map<string, { session: RealtimeSession | null, agent: RealtimeAgent | null }>();

// Enhanced logging
function logWithTimestamp(level: string, message: string, sessionId?: string) {
  const timestamp = new Date().toISOString();
  const prefix = sessionId ? `[${sessionId}]` : '';
  console.log(`${level} [${timestamp}] ${prefix} ${message}`);
}

// Main Application
export function initializeAlexCoach() {
  const appSessionId = generateSessionTrackingId();
  logWithTimestamp('🚀', 'Initializing Alex Coach - Official Realtime SDK', appSessionId);

  // DOM Elements
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
  let agent: RealtimeAgent | null = null;
  let session: RealtimeSession | null = null;
  let storedSessions: SessionStorage = loadSessionStorage();
  let currentSessionTrackingId: string | null = null;
  let isInitializing = false; // Prevent multiple initializations
  let lastButtonClick = 0; // Rate limiting

  // Emergency session killer function (defined early)
  const killAllSessions = async () => {
    logWithTimestamp('🚨', `EMERGENCY: Killing all ${activeSessions.size} active sessions`, 'EMERGENCY');
    
    for (const [sessionId, sessionData] of activeSessions.entries()) {
      try {
        if (sessionData.session) {
          await sessionData.session.interrupt();
          logWithTimestamp('💀', `Killed session: ${sessionId}`, 'EMERGENCY');
        }
      } catch (e) {
        logWithTimestamp('⚠️', `Failed to kill session ${sessionId}: ${e}`, 'EMERGENCY');
      }
    }
    
    activeSessions.clear();
    session = null;
    agent = null;
    isVoiceConnected = false;
    currentSessionTrackingId = null;
    
    voiceStatus.textContent = '🎙️ Alle Sessions beendet - Klicken zum Neu-Starten';
    voiceButton.textContent = '🎤 Sprechen';
    voiceButton.style.backgroundColor = '#3b82f6';
    voiceButton.disabled = false;
    
    logWithTimestamp('✅', 'All sessions killed', 'EMERGENCY');
  };

  // Session tracking functions
  const logSessionState = () => {
    const activeSessionCount = activeSessions.size;
    const currentState = {
      isVoiceConnected,
      hasSession: !!session,
      hasAgent: !!agent,
      trackingId: currentSessionTrackingId,
      totalActiveSessions: activeSessionCount
    };
    logWithTimestamp('📊', `Session State: ${JSON.stringify(currentState)}`, currentSessionTrackingId || 'NO_ID');
  };

  // Alex Coach Instructions (following Quickstart pattern)
  const ALEX_COACH_INSTRUCTIONS = `
Du bist Alex Coach, ein lebendiger und inspirierender Life Coach.

PERSÖNLICHKEIT:
- Warm, empathisch aber auch ehrlich und direkt
- Nutze "Du" und sei persönlich im Gespräch
- Stelle durchdachte Fragen, die zum Nachdenken anregen
- Feiere kleine und große Erfolge mit echter Begeisterung
- Sei geduldig aber auch herausfordernd wenn nötig
- Verwende eine natürliche, conversational deutsche Sprache

GESPRÄCHSSTIL:
- Halte Antworten prägnant aber wirkungsvoll (max 3-4 Sätze)
- Stelle eine durchdachte Frage pro Antwort
- Nutze Beispiele aus dem echten Leben
- Sei authentisch und vermeide Coaching-Klischees
- Reagiere auf die emotionale Ebene der Person

ZIEL: Echte, dauerhafte positive Veränderung durch prägnante, wirkungsvolle Gespräche.

Beginne mit einer warmen Begrüßung und frage, womit du heute helfen kannst.
`;

  // Clean up existing session with correct interrupt() method
  const cleanupSession = async () => {
    logWithTimestamp('🧹', 'Starting session cleanup...', currentSessionTrackingId || 'NO_ID');
    logSessionState();
    
    if (session) {
      try {
        logWithTimestamp('🔇', 'Interrupting session...', currentSessionTrackingId || 'NO_ID');
        await session.interrupt();
        logWithTimestamp('✅', 'Session interrupted successfully', currentSessionTrackingId || 'NO_ID');
      } catch (e) {
        logWithTimestamp('⚠️', `Session cleanup warning: ${e}`, currentSessionTrackingId || 'NO_ID');
      }
      session = null;
    }
    
    if (agent) {
      agent = null;
    }
    
    // Remove from tracking
    if (currentSessionTrackingId) {
      activeSessions.delete(currentSessionTrackingId);
      logWithTimestamp('🗑️', `Removed session from tracking. Remaining: ${activeSessions.size}`, currentSessionTrackingId);
      currentSessionTrackingId = null;
    }
    
    isVoiceConnected = false;
    logSessionState();
  };

  // Initialize Voice Agent (following Quickstart Guide exactly)
  const initializeVoiceAgent = async () => {
    const newSessionId = generateSessionTrackingId();
    logWithTimestamp('🚀', 'Starting voice agent initialization...', newSessionId);
    logSessionState();
    
    try {
      // STRICT: Prevent ANY multiple initializations
      if (isInitializing) {
        logWithTimestamp('🚫', 'BLOCKED: Already initializing!', newSessionId);
        return;
      }
      
      if (isVoiceConnected || session || currentSessionTrackingId) {
        logWithTimestamp('🚫', `BLOCKED: Voice agent already active! Current: ${currentSessionTrackingId}`, newSessionId);
        logSessionState();
        return;
      }

      // Check for any lingering sessions - FORCE KILL THEM
      if (activeSessions.size > 0) {
        logWithTimestamp('🚨', `EMERGENCY: ${activeSessions.size} active sessions detected! Force killing all...`, newSessionId);
        await killAllSessions();
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      currentSessionTrackingId = newSessionId;
      voiceStatus.textContent = 'Verbinde mit Alex Coach...';
      voiceButton.disabled = true;

      // Clean up any existing session first
      await cleanupSession();
      
      // Re-assign tracking ID after cleanup
      currentSessionTrackingId = newSessionId;

      logWithTimestamp('🔑', 'Getting ephemeral key...', currentSessionTrackingId);
      
      // Get ephemeral key from backend
      const apiUrl = window.location.origin + '/api/openai-key';
      const keyResponse = await fetch(apiUrl);
      
      if (!keyResponse.ok) {
        const errorText = await keyResponse.text();
        throw new Error(`Failed to get ephemeral key: ${keyResponse.status} ${errorText}`);
      }
      
      const { apiKey } = await keyResponse.json();
      console.log('✅ Ephemeral key received:', apiKey?.substring(0, 10) + '...');

      // Step 3: Create Agent (following Quickstart)
      logWithTimestamp('🤖', 'Creating RealtimeAgent...', currentSessionTrackingId!);
      agent = new RealtimeAgent({
        name: 'Alex Coach',
        instructions: ALEX_COACH_INSTRUCTIONS,
      });

      // Step 4: Create Session (following Quickstart)
      logWithTimestamp('📞', 'Creating RealtimeSession...', currentSessionTrackingId!);
      session = new RealtimeSession(agent, {
        model: 'gpt-realtime',
      });

      // Add to tracking BEFORE connecting
      activeSessions.set(currentSessionTrackingId!, { session, agent });
      logWithTimestamp('📝', `Session added to tracking. Total: ${activeSessions.size}`, currentSessionTrackingId!);

      // Step 5: Connect to session (following Quickstart)
      logWithTimestamp('🔌', 'Connecting to session...', currentSessionTrackingId!);
      await session.connect({ apiKey });

      logWithTimestamp('🎉', 'Alex Coach Voice Agent connected successfully!', currentSessionTrackingId!);
      isVoiceConnected = true;
      voiceStatus.textContent = '🎙️ Alex Coach bereit - Sprechen Sie!';
      voiceButton.disabled = false;
      voiceButton.style.backgroundColor = '#22c55e';
      voiceButton.textContent = '🔇 Beenden';
      
      logSessionState();

    } catch (error) {
      logWithTimestamp('❌', `Voice Agent initialization failed: ${error}`, currentSessionTrackingId || 'NO_ID');
      
      let errorMessage = 'Unbekannter Fehler';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      voiceStatus.textContent = `❌ Verbindungsfehler: ${errorMessage}`;
      voiceButton.style.backgroundColor = '#ef4444';
      voiceButton.textContent = '🔄 Erneut versuchen';
      voiceButton.disabled = false;
      
      // Clean up failed session
      await cleanupSession();
      
      logWithTimestamp('❌', 'Connection failed. User can retry manually.', 'FAILED');
      logSessionState();
    }
  };

  // Voice interaction with proper interrupt() handling
  const handleVoiceInteraction = async () => {
    // Rate limiting - prevent rapid clicks
    const now = Date.now();
    if (now - lastButtonClick < 2000) {
      logWithTimestamp('🚫', 'Rate limited - button clicked too quickly', 'RATE_LIMIT');
      return;
    }
    lastButtonClick = now;

    // Prevent multiple initializations
    if (isInitializing) {
      logWithTimestamp('🚫', 'Already initializing - ignoring click', 'INITIALIZING');
      return;
    }

    logWithTimestamp('🔘', 'Voice button clicked', currentSessionTrackingId || 'NO_ID');
    logSessionState();
    
    if (isVoiceConnected && session && agent) {
      // Disconnect current session using interrupt()
      logWithTimestamp('🔇', 'User requested to end voice session', currentSessionTrackingId!);
      voiceStatus.textContent = '🔇 Beende Gespräch...';
      voiceButton.disabled = true;
      
      try {
        await cleanupSession();
        logWithTimestamp('✅', 'Voice session ended successfully', 'ENDED');
        voiceStatus.textContent = '✅ Gespräch beendet - Klicken zum Neu-Verbinden';
        voiceButton.textContent = '🎤 Sprechen';
        voiceButton.style.backgroundColor = '#3b82f6';
        voiceButton.disabled = false;
      } catch (error) {
        logWithTimestamp('❌', `Error ending session: ${error}`, currentSessionTrackingId || 'ERROR');
        voiceStatus.textContent = '❌ Fehler beim Beenden - Seite neu laden empfohlen';
        voiceButton.textContent = '🔄 Erneut versuchen';
        voiceButton.style.backgroundColor = '#ef4444';
        voiceButton.disabled = false;
        // Force cleanup state
        session = null;
        agent = null;
        isVoiceConnected = false;
        if (currentSessionTrackingId) {
          activeSessions.delete(currentSessionTrackingId);
          currentSessionTrackingId = null;
        }
      }
      
    } else if (!isVoiceConnected) {
      // Start new session
      logWithTimestamp('▶️', 'Starting new voice session', 'NEW');
      isInitializing = true;
      try {
        await initializeVoiceAgent();
      } finally {
        isInitializing = false;
      }
    }
    
    logSessionState();
  };

  // UI Functions
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
        ${currentSession ? `
        <div class="stat">
          <span class="stat-label">Aktuelle Session:</span>
          <span class="stat-value">${currentSession.notes.length} Notizen</span>
        </div>
        ` : ''}
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
      
      // Start new coaching session
      currentSession = {
        id: generateSessionId(),
        startTime: new Date(),
        notes: []
      };
      
      console.log('✅ Access granted, starting coaching session:', currentSession.id);
      
      // DO NOT auto-initialize voice agent - user must click button
      logWithTimestamp('⚠️', 'Access granted - Voice agent NOT auto-started. User must click button.', appSessionId);
      
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

  // Emergency session killer function was moved up - this duplicate is removed

  // Voice button
  voiceButton.addEventListener('click', handleVoiceInteraction);
  voiceButton.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Emergency session killer on double-click
  voiceButton.addEventListener('dblclick', async (e) => {
    e.preventDefault();
    logWithTimestamp('🚨', 'Double-click detected - Emergency session cleanup', 'EMERGENCY');
    await killAllSessions();
  });

  // Cleanup on page unload to prevent multiple sessions
  window.addEventListener('beforeunload', async () => {
    if (session || isVoiceConnected) {
      console.log('🧹 Cleaning up session on page unload');
      await cleanupSession();
    }
  });

  // Cleanup on visibility change (when tab becomes inactive)
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden && session && isVoiceConnected) {
      console.log('🧹 Tab hidden, cleaning up voice session');
      await cleanupSession();
      voiceStatus.textContent = '🎙️ Klicken zum Verbinden';
      voiceButton.textContent = '🎤 Sprechen';
      voiceButton.style.backgroundColor = '#3b82f6';
    }
  });

  // Session monitoring - check every 5 seconds for multiple sessions
  setInterval(() => {
    const sessionCount = activeSessions.size;
    if (sessionCount > 1) {
      logWithTimestamp('🚨', `ALERT: ${sessionCount} active sessions detected!`, 'MONITOR');
      // Emergency cleanup if more than 1 session
      killAllSessions();
    } else if (sessionCount === 1 && !isVoiceConnected) {
      logWithTimestamp('⚠️', 'Session exists but UI shows disconnected', 'MONITOR');
    }
  }, 5000);

  // Initialize UI
  updateUI();
  
  logWithTimestamp('🎯', 'Alex Coach Realtime SDK Version ready', appSessionId);
  logWithTimestamp('📋', `Session management initialized`, appSessionId);
}