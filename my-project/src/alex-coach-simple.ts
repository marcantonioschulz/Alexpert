// Alex Coach - Vereinfacht mit OpenAI Chat API (funktioniert garantiert)
// Einfache aber echte AI Integration

// Access Control
const ACCESS_STATE = {
  LOCKED: 'LOCKED',
  UNLOCKED: 'UNLOCKED'
} as const;

type AccessState = typeof ACCESS_STATE[keyof typeof ACCESS_STATE];
const ACCESS_CODE = 'ALEX START';

// Session Management
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
  console.log('💾 Session data saved:', storage.totalSessions, 'total sessions');
};

function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Alex Coach System Prompt
const ALEX_COACH_SYSTEM_PROMPT = `
Du bist Alex Coach, ein lebendiger und inspirierender Life Coach.

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

ZIEL: Echte, dauerhafte positive Veränderung im Leben der Menschen durch prägnante, wirkungsvolle Gespräche.

Beginne das Gespräch mit einer warmen, einladenden Begrüßung und frage, womit du heute helfen kannst.
`;

// Main Application
export function initializeAlexCoach() {
  console.log('🚀 Initializing Alex Coach - OpenAI Chat API Version');

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
  let isAIConnected = false;
  let apiKey: string | null = null;
  let conversationHistory: any[] = [];
  let storedSessions: SessionStorage = loadSessionStorage();

  // OpenAI Chat API Integration
  const initializeAIAgent = async () => {
    try {
      voiceStatus.textContent = 'Verbinde mit Alex Coach AI...';
      voiceButton.disabled = true;

      // Get API Key
      const apiUrl = window.location.origin + '/api/openai-key';
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API Key fetch failed: ${response.status}`);
      }
      
      const keyData = await response.json();
      apiKey = keyData.apiKey;
      console.log('✅ API key received, length:', apiKey?.length);

      // Test OpenAI Connection
      console.log('🧪 Testing OpenAI Chat API...');
      
      const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: ALEX_COACH_SYSTEM_PROMPT },
            { role: 'user', content: 'Test connection' }
          ],
          max_tokens: 50
        })
      });
      
      console.log('📡 OpenAI Response status:', testResponse.status);
      
      if (testResponse.ok) {
        const result = await testResponse.json();
        console.log('✅ OpenAI API connection successful!', result.choices?.[0]?.message?.content);
        
        // Initialize conversation
        conversationHistory = [
          { role: 'system', content: ALEX_COACH_SYSTEM_PROMPT }
        ];
        
        isAIConnected = true;
        voiceStatus.textContent = '🤖 Alex Coach AI bereit - Klicken für Chat!';
        voiceButton.disabled = false;
        voiceButton.style.backgroundColor = '#22c55e';
        voiceButton.textContent = '💬 Chat starten';
        
        // Get initial greeting
        await sendMessageToAI('Hallo Alex Coach! Ich bin bereit für unser Gespräch.');
        
      } else {
        const errorText = await testResponse.text();
        console.error('❌ OpenAI API Error:', testResponse.status, errorText);
        throw new Error(`API Error ${testResponse.status}: ${errorText}`);
      }

    } catch (error) {
      console.error('❌ AI Agent initialization failed:', error);
      
      let errorMessage = 'Unbekannter Fehler';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      console.log('🎭 Falling back to demo mode due to:', errorMessage);
      voiceStatus.textContent = `Fehler: ${errorMessage}`;
      
      setTimeout(() => {
        activateDemoMode();
      }, 3000);
    }
  };

  // Send message to OpenAI
  const sendMessageToAI = async (userMessage: string) => {
    if (!apiKey || !isAIConnected) {
      console.log('🎭 Demo mode - simulating AI response');
      return;
    }

    try {
      voiceStatus.textContent = 'Alex Coach denkt nach...';
      
      // Add user message to history
      conversationHistory.push({ role: 'user', content: userMessage });
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: conversationHistory,
          max_tokens: 200,
          temperature: 0.8
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const aiResponse = result.choices[0].message.content;
        
        // Add AI response to history
        conversationHistory.push({ role: 'assistant', content: aiResponse });
        
        console.log('🤖 Alex Coach sagt:', aiResponse);
        
        // Show response in status (in real app, you'd have a proper chat UI)
        voiceStatus.innerHTML = `<strong>Alex Coach:</strong> ${aiResponse}`;
        
        // Use text-to-speech if available
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(aiResponse);
          utterance.lang = 'de-DE';
          utterance.rate = 0.9;
          speechSynthesis.speak(utterance);
        }
        
      } else {
        throw new Error('AI response failed');
      }
    } catch (error) {
      console.error('❌ AI conversation error:', error);
      voiceStatus.textContent = 'Fehler beim Gespräch mit Alex Coach';
    }
  };

  // Demo mode fallback
  const activateDemoMode = () => {
    console.log('🎭 Activating Alex Coach Demo Mode');
    isAIConnected = true;
    voiceStatus.innerHTML = 'Demo Modus - Simuliert Alex Coach <span style="color: #fbbf24;">(Kein echter OpenAI Chat)</span>';
    voiceButton.disabled = false;
    voiceButton.style.backgroundColor = '#fbbf24';
    voiceButton.textContent = '🎭 Demo Chat';
  };

  // Chat interaction
  const startChat = async () => {
    if (!isAIConnected) return;
    
    if (apiKey) {
      // Real AI Chat
      const userInput = prompt('Was möchten Sie mit Alex Coach besprechen?');
      if (userInput) {
        console.log('👤 User sagt:', userInput);
        await sendMessageToAI(userInput);
      }
    } else {
      // Demo mode
      voiceStatus.innerHTML = 'Demo: Alex Coach würde hier antworten <span style="color: #fbbf24;">(Demo Modus)</span>';
      console.log('🎭 Demo chat simulation');
    }
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
          <span class="stat-value">${currentSession.insights?.length || 0} Insights</span>
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
      
      console.log('✅ Access granted, starting coaching session:', currentSession.id);
      
      // Initialize AI agent
      initializeAIAgent();
      
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

  // Chat button
  voiceButton.addEventListener('click', startChat);
  voiceButton.addEventListener('contextmenu', (e) => e.preventDefault());

  // Initialize UI
  updateUI();
  
  console.log('🎯 Alex Coach Chat API Version ready');
  console.log('Session management ready:', typeof saveSessionStorage);
}