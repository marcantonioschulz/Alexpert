import { useMemo } from 'react';
import { useSimulation } from './hooks/useSimulation';
import styles from './styles/App.module.css';
import { AnalyticsDashboard } from './features/analytics/AnalyticsDashboard';
import { downloadMarkdownReport, downloadPdfReport } from './features/export/reportUtils';

type SpeakerState = 'idle' | 'ai' | 'user';

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

function SpeakerPill({
  label,
  active,
  variant,
  description
}: {
  label: string;
  active: boolean;
  variant: 'user' | 'ai';
  description: string;
}) {
  return (
    <div
      className={`${styles.speakerPill} ${
        active ? `${styles.speakerPillActive} ${styles[`speakerPill${variant === 'ai' ? 'Ai' : 'User'}`]}` : ''
      }`}
    >
      <div className={styles.speakerMeta}>
        <span className={styles.speakerLabel}>{label}</span>
        <span className={styles.speakerDescription}>{description}</span>
      </div>
      <div className={styles.voiceWave} data-active={active}>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function SpeakerIndicator({ speakerState }: { speakerState: SpeakerState }) {
  return (
    <div className={styles.speakerStatus}>
      <SpeakerPill
        label="Du"
        variant="user"
        active={speakerState === 'user'}
        description={speakerState === 'user' ? 'Du sprichst gerade' : 'Bereit'}
      />
      <SpeakerPill
        label="KI"
        variant="ai"
        active={speakerState === 'ai'}
        description={speakerState === 'ai' ? 'Antwortet dir' : 'Wartet auf dich'}
      />
    </div>
  );
}

function App() {
  const {
    audioRef,
    conversationId,
    conversationDetails,
    endSimulation,
    error,
    fetchTranscript,
    scorePhase,
    speakerState,
    requestScore,
    saveTranscript,
    score,
    startSimulation,
    status,
    transcript,
    transcriptPhase,
    transcriptDraft,
    setTranscriptDraft
  } = useSimulation();

  const canStart = status === 'idle' || status === 'ended' || status === 'error';
  const canStop = status === 'live';

  const sharedReportData = conversationId && score
    ? {
        conversationId,
        score: score.score,
        feedback: score.feedback,
        transcript: transcript ?? conversationDetails?.transcript ?? null,
        generatedAt: conversationDetails?.createdAt ?? null
      }
    : null;

  const handleMarkdownExport = () => {
    if (!sharedReportData) {
      return;
    }

    downloadMarkdownReport(sharedReportData);
  };

  const handlePdfExport = () => {
    if (!sharedReportData) {
      return;
    }

    downloadPdfReport(sharedReportData);
  };

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
        <section className={styles.card}>
          <h2>Simulation steuern</h2>
          <p>Starte die Simulation und sprich mit der KI über dein Angebot.</p>
          <SpeakerIndicator speakerState={speakerState} />
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
          {error && (
            <div className={styles.errorPanel}>
              <p>{error}</p>
              {status === 'error' && (
                <button type="button" onClick={startSimulation}>
                  Erneut versuchen
                </button>
              )}
            </div>
          )}
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
            <button
              type="button"
              onClick={saveTranscript}
              disabled={!transcriptDraft || transcriptPhase === 'saving'}
            >
              Transkript speichern
            </button>
            <button
              type="button"
              onClick={fetchTranscript}
              disabled={!conversationId || transcriptPhase === 'loading'}
            >
              Transkript anzeigen
            </button>
          </div>
          {transcriptPhase === 'saving' && (
            <p className={styles.helper}>Transkript wird gespeichert...</p>
          )}
          {transcriptPhase === 'loading' && (
            <div className={styles.transcriptSkeleton} aria-hidden>
              <span />
              <span />
              <span />
            </div>
          )}
          {transcript && transcriptPhase !== 'loading' && (
            <pre className={styles.transcript}>{transcript}</pre>
          )}
        </section>

        <section className={styles.card}>
          <h2>Scoreboard</h2>
          <p>Fordere eine Bewertung der Unterhaltung anhand der Kriterien Klarheit, Bedarf und Einwände an.</p>
          <button
            type="button"
            onClick={requestScore}
            disabled={!conversationId || scorePhase === 'loading'}
          >
            {scorePhase === 'loading' ? 'Bewertung wird berechnet…' : 'Score berechnen'}
          </button>
          {scorePhase === 'loading' && (
            <div className={styles.scoreSkeleton} aria-hidden>
              <div className={styles.scoreSkeletonValue} />
              <div className={styles.scoreSkeletonText} />
            </div>
          )}
          {scorePhase === 'error' && (
            <p className={styles.errorInline}>
              Score konnte nicht geladen werden. Bitte versuche es erneut.
            </p>
          )}
          {score && scorePhase === 'ready' && (
            <div className={styles.scorePanel}>
              <div className={styles.scoreValue}>{score.score}</div>
              <p>{score.feedback}</p>
              <div className={styles.exportActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleMarkdownExport}
                  disabled={!sharedReportData}
                >
                  Markdown exportieren
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handlePdfExport}
                  disabled={!sharedReportData}
                >
                  PDF exportieren
                </button>
              </div>
            </div>
          )}
        </section>

        <section className={`${styles.card} ${styles.fullWidthCard}`}>
          <AnalyticsDashboard />
        </section>
      </main>
    </div>
  );
}

export default App;
