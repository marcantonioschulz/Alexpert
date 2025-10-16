import { useEffect, useMemo } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { useUserPreferences } from './hooks/useUserPreferences';
import { Settings } from './components/Settings';
import styles from './styles/App.module.css';

function StatusBadge({ status }: { status: string }) {
  const label = useMemo(() => {
    switch (status) {
      case 'starting':
        return 'Verbindung wird aufgebaut...';
      case 'live':
        return 'Simulation läuft';
      case 'ended':
        return 'Simulation beendet';
      case 'error':
        return 'Fehler';
      default:
        return 'Bereit';
    }
  }, [status]);

  const statusClass = useMemo(() => {
    switch (status) {
      case 'starting':
        return styles.badgeStarting;
      case 'live':
        return styles.badgeLive;
      case 'ended':
        return styles.badgeEnded;
      case 'error':
        return styles.badgeError;
      default:
        return undefined;
    }
  }, [status]);

  return <span className={`${styles.badge} ${statusClass ?? ''}`}>{label}</span>;
}

function App() {
  const userId = 'demo-user';
  const {
    preferences,
    updatePreference,
    savePreferences,
    isLoading: isPreferencesLoading,
    isSaving: isPreferencesSaving,
    error: preferencesError,
    hasChanges: preferencesChanged
  } = useUserPreferences(userId);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const targetTheme =
        preferences.theme === 'system'
          ? mediaQuery.matches
            ? 'dark'
            : 'light'
          : preferences.theme;
      root.dataset.theme = targetTheme;
    };

    applyTheme();

    if (preferences.theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => {
        mediaQuery.removeEventListener('change', applyTheme);
      };
    }

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
    };
  }, [preferences]);

  const simulationOptions = useMemo(() => {
    if (!preferences) {
      return null;
    }

    return {
      userId: preferences.userId,
      preferences: {
        realtimeModel: preferences.realtimeModel,
        responsesModel: preferences.responsesModel,
        apiKeyOverride: preferences.apiKeyOverride
      }
    } as const;
  }, [preferences]);

  const {
    audioRef,
    conversationId,
    endSimulation,
    error,
    fetchTranscript,
    requestScore,
    saveTranscript,
    score,
    startSimulation,
    status,
    transcript,
    transcriptDraft,
    setTranscriptDraft
  } = useSimulation(simulationOptions);

  const canStart =
    !isPreferencesLoading && !!preferences && (status === 'idle' || status === 'ended' || status === 'error');
  const canStop = status === 'live';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>KI Verkaufssimulation</h1>
          <p>Trainiere dein Verkaufsgespräch mit einer Realtime-KI.</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <main className={styles.main}>
        <Settings
          className={`${styles.card} ${styles.settingsCard}`}
          preferences={preferences}
          isLoading={isPreferencesLoading}
          isSaving={isPreferencesSaving}
          hasChanges={preferencesChanged}
          error={preferencesError}
          onChange={updatePreference}
          onSave={savePreferences}
        />
        <section className={styles.card}>
          <h2>Simulation steuern</h2>
          <p>Starte die Simulation und sprich mit der KI über dein Angebot.</p>
          <div className={styles.actions}>
            <button type="button" onClick={startSimulation} disabled={!canStart}>
              Starte Simulation
            </button>
            <button type="button" onClick={endSimulation} disabled={!canStop}>
              Simulation beenden
            </button>
          </div>
          {conversationId && (
            <p className={styles.meta}>Konversation-ID: {conversationId}</p>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <audio ref={audioRef} autoPlay className={styles.audio} />
        </section>

        <section className={styles.card}>
          <h2>Transkript</h2>
          <p>
            Nach dem Gespräch kannst du das Transkript speichern oder erneut laden, sobald es
            verarbeitet wurde.
          </p>
          <textarea
            placeholder="Transkript hier einfügen oder bearbeiten"
            rows={6}
            value={transcriptDraft}
            onChange={(event) => setTranscriptDraft(event.target.value)}
          />
          <div className={styles.actions}>
            <button type="button" onClick={saveTranscript} disabled={!transcriptDraft}>
              Transkript speichern
            </button>
            <button type="button" onClick={fetchTranscript} disabled={!conversationId}>
              Transkript anzeigen
            </button>
          </div>
          {transcript && <pre className={styles.transcript}>{transcript}</pre>}
        </section>

        <section className={styles.card}>
          <h2>Scoreboard</h2>
          <p>Fordere eine Bewertung der Unterhaltung anhand der Kriterien Klarheit, Bedarf und Einwände an.</p>
          <button type="button" onClick={requestScore} disabled={!conversationId}>
            Score berechnen
          </button>
          {score && (
            <div className={styles.scorePanel}>
              <div className={styles.scoreValue}>{score.score}</div>
              <p>{score.feedback}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
