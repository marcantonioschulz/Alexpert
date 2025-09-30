// Alex Coach - Production Version mit OpenAI Agents Realtime SDK
// Echte Voice AI Integration für Life Coaching

import { z } from 'zod';
import { RealtimeAgent, RealtimeSession, tool } from '@openai/agents-realtime';

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
  insights: string[];
}

interface SessionStorage {
  totalSessions: number;
  averageAhaScore: number;
  lastSession?: CoachingSession;
  allSessions: CoachingSession[];
}

// Alex Coach Tools - Realtime funktionen
const trackInsightTool = tool({
  name: 'track_insight',
  description: 'Speichere wichtige Erkenntnisse oder Aha-Momente des Coachees',
  parameters: z.object({
    insight: z.string().describe('Der wichtige Einblick oder Aha-Moment'),
    importance: z.number().min(1).max(5).describe('Wichtigkeit von 1-5')
  }),
  execute: async (input) => {
    console.log('💡 Insight erfasst:', input.insight, `(Wichtigkeit: ${input.importance})`);
    // Store insight in current session
    if (currentSession) {
      currentSession.insights.push(`${input.insight} (${input.importance}/5)`);
      saveCurrentSession();
    }
    return `Insight gespeichert: ${input.insight}`;
  },
});

const setAhaScoreTool = tool({
  name: 'set_aha_score',
  description: 'Setze den finalen Aha-Score für die Session (1-10)',
  parameters: z.object({
    score: z.number().min(1).max(10).describe('Aha-Score von 1-10'),
    reason: z.string().describe('Begründung für diesen Score')
  }),
  execute: async (input) => {
    console.log('🎯 Aha-Score gesetzt:', input.score, '-', input.reason);
    if (currentSession) {
      currentSession.ahaScore = input.score;
      currentSession.notes.push(`Final Score: ${input.score}/10 - ${input.reason}`);
      saveCurrentSession();
      // updateSessionDisplay wird später definiert
      console.log('Session updated with Aha-Score:', input.score);
    }
    return `Aha-Score ${input.score}/10 gesetzt: ${input.reason}`;
  },
});

// Storage functions
function loadSessionStorage(): SessionStorage {
  const stored = localStorage.getItem('alex-coach-sessions');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      // Convert date strings back to Date objects
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

function saveSessionStorage(storage: SessionStorage) {
  localStorage.setItem('alex-coach-sessions', JSON.stringify(storage));
  console.log('Session storage updated:', storage.totalSessions, 'sessions');
}

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Global session state
let currentSession: CoachingSession | null = null;
let storedSessions: SessionStorage = loadSessionStorage();

function saveCurrentSession() {
  if (!currentSession) return;
  
  // Update session in storage
  const existingIndex = storedSessions.allSessions.findIndex(s => s.id === currentSession!.id);
  if (existingIndex >= 0) {
    storedSessions.allSessions[existingIndex] = currentSession;
  } else {
    storedSessions.allSessions.push(currentSession);
    storedSessions.totalSessions = storedSessions.allSessions.length;
  }
  
  // Calculate average aha score
  const sessionsWithScore = storedSessions.allSessions.filter(s => s.ahaScore);
  if (sessionsWithScore.length > 0) {
    storedSessions.averageAhaScore = 
      sessionsWithScore.reduce((sum, s) => sum + (s.ahaScore || 0), 0) / sessionsWithScore.length;
  }
  
  storedSessions.lastSession = currentSession;
  saveSessionStorage(storedSessions);
}

// Alex Coach Personality & Instructions
const ALEX_COACH_INSTRUCTIONS = `
Du bist Alex Coach, ein lebendiger und inspirierender Life Coach mit folgender Persönlichkeit:

PERSÖNLICHKEIT:
- Warm, empathisch aber auch ehrlich und direkt
- Nutze "Du" und sei persönlich im Gespräch
- Stelle durchdachte Fragen, die zum Nachdenken anregen
- Feiere kleine und große Erfolge mit echter Begeisterung
- Sei geduldig aber auch herausfordernd wenn nötig
- Verwende eine natürliche, conversational deutsche Sprache

DEINE ROLLE:
- Hilf Menschen dabei, ihre Lebensbereiche zu verbessern
- Fokussiere auf praktische, umsetzbare Schritte
- Unterstütze beim Finden von Lösungen, gib nicht nur Ratschläge
- Ermutige zur Selbstreflexion
- Sei ein Sparringspartner für Ideen und Pläne

GESPRÄCHSSTIL:
- Halte Antworten prägnant aber wirkungsvoll (max 3-4 Sätze)
- Stelle eine durchdachte Frage pro Antwort
- Nutze Beispiele aus dem echten Leben
- Sei authentisch und vermeide Coaching-Klischees
- Reagiere auf die emotionale Ebene der Person

VERMEIDE:
- Lange Monologe oder Vorträge
- Übermäßig positive oder künstliche Sprache
- Vorschriften ohne Verständnis der Situation
- Komplizierte Theorien oder Frameworks

TOOLS NUTZEN:
- Verwende track_insight() wenn die Person wichtige Erkenntnisse hat
- Setze set_aha_score() am Ende einer Session (1-10 basierend auf Durchbrüchen)
- Dokumentiere den Coaching-Prozess für nachhaltigen Fortschritt

ZIEL: Echte, dauerhafte positive Veränderung im Leben der Menschen durch prägnante, wirkungsvolle Gespräche.
`;

// Main Alex Coach Application  
export function initializeAlexCoach() {
  console.log('🚀 Initializing Alex Coach - Production Voice AI');

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
  let realtimeAgent: RealtimeAgent | null = null;
  let realtimeSession: RealtimeSession | null = null;

  // Alex Coach Realtime Agent Setup
  const initializeVoiceAgent = async () => {
    try {
      voiceStatus.textContent = 'Verbinde mit Alex Coach...';
      voiceButton.disabled = true;

      // Get API Key from backend
      console.log('🔑 Fetching API key...');
      const apiUrl = window.location.origin + '/api/openai-key';
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to get API key');
      }
      
      const { apiKey } = await response.json();
      console.log('✅ API key received, length:', apiKey?.length);
      console.log('🔑 API key starts with:', apiKey?.substring(0, 10) + '...');

      // Create Realtime Agent mit Alex Coach Persönlichkeit
      realtimeAgent = new RealtimeAgent({
        name: 'Alex Coach',
        instructions: ALEX_COACH_INSTRUCTIONS,
        tools: [trackInsightTool, setAhaScoreTool]
      });

      // Create Realtime Session
      realtimeSession = new RealtimeSession(realtimeAgent);
      console.log('�️ Realtime session created');

      // Connect to OpenAI mit detailliertem Error Handling
      console.log('🔌 Attempting connection to OpenAI Realtime API...');
      
      try {
        await realtimeSession.connect({ apiKey });
        
        console.log('🎉 Alex Coach Voice Agent connected successfully!');
        isVoiceConnected = true;
        voiceStatus.textContent = 'Bereit - Sprechen Sie mit Alex Coach';
        voiceButton.disabled = false;
        voiceButton.style.backgroundColor = '#22c55e';
        
        // Test connection
        console.log('✅ OpenAI Realtime connection established');
        
      } catch (connectionError) {
        console.error('🔥 OpenAI connection failed:', connectionError);
        throw connectionError;
      }
      
    } catch (error) {
      console.error('❌ Voice Agent initialization failed:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', error);
      
      // Zeige spezifischen Fehler in UI
      if (error instanceof Error) {
        voiceStatus.textContent = `Fehler: ${error.message}`;
        console.log('🚨 Specific error:', error.message);
      }
      
      // Fallback zum Demo Modus
      console.log('🎭 Falling back to demo mode due to connection failure');
      setTimeout(() => activateDemoMode(), 2000);
    }
  };

  // Demo mode fallback
  const activateDemoMode = () => {
    console.log('🎭 Activating Alex Coach Demo Mode');
    isVoiceConnected = true;
    voiceStatus.textContent = 'Demo Modus - Klicken zum Test';
    voiceButton.disabled = false;
    voiceButton.style.backgroundColor = '#fbbf24';
    voiceStatus.innerHTML += ' <span style="color: #fbbf24;">(Demo - Kein echter Voice Chat)</span>';
  };

  // Voice Interaction - Push to Talk
  let isListening = false;

  const startListening = () => {
    if (!isVoiceConnected) return;
    
    if (realtimeSession) {
      // OpenAI Realtime Session läuft automatisch - kein manuelles start/stop nötig
      isListening = true;
      voiceButton.textContent = '🎤 Höre zu...';
      voiceButton.style.backgroundColor = '#dc2626';
      voiceStatus.textContent = 'Sprechen Sie jetzt...';
      console.log('🎤 Voice session active - listening to user');
    } else {
      // Demo mode
      voiceButton.textContent = '🎤 Demo Modus...';
      voiceButton.style.backgroundColor = '#dc2626';
      voiceStatus.textContent = 'Demo: Simuliere Zuhören...';
    }
  };

  const stopListening = () => {
    if (!isVoiceConnected) return;
    
    if (realtimeSession && isListening) {
      // Realtime Session verarbeitet Audio automatisch
      isListening = false;
      voiceButton.textContent = '🎙️ Sprechen';
      voiceButton.style.backgroundColor = '#22c55e';
      voiceStatus.textContent = 'Alex Coach antwortet...';
      console.log('🎤 Processing voice input with Alex Coach');
    } else {
      // Demo mode response
      voiceButton.textContent = '🎙️ Sprechen';
      voiceButton.style.backgroundColor = '#fbbf24';
      setTimeout(() => {
        voiceStatus.innerHTML = 'Demo Modus - Klicken zum Test <span style="color: #fbbf24;">(Demo)</span>';
        console.log('🎭 Demo: Alex Coach würde hier antworten');
      }, 2000);
    }
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
        ${currentSession ? `
        <div class="stat">
          <span class="stat-label">Aktuelle Session:</span>
          <span class="stat-value">${currentSession.insights.length} Insights</span>
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
        notes: [],
        insights: []
      };
      
      console.log('✅ Access granted, starting new coaching session:', currentSession.id);
      
      // Initialize voice agent
      initializeVoiceAgent();
      
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
  
  // Prevent context menu
  voiceButton.addEventListener('contextmenu', (e) => e.preventDefault());

  // Initialize UI
  updateUI();
  
  console.log('🎯 Alex Coach Production Version ready');
}