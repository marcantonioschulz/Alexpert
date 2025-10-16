import type { FormEvent } from 'react';
import type { ThemePreference, UserPreferences } from '../types/preferences';
import styles from './Settings.module.css';

type SettingsProps = {
  className?: string;
  preferences: UserPreferences | null;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  error: string | null;
  onChange: (update: Partial<UserPreferences>) => void;
  onSave: () => Promise<void> | void;
};

const REALTIME_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
  { value: 'gpt-4o-realtime-preview-2024-10-01', label: 'GPT-4o Realtime Preview (Okt 2024)' },
  { value: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS' }
];

const RESPONSES_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'o4-mini', label: 'o4 mini' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' }
];

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'system', label: 'System' }
];

export function Settings({
  className,
  preferences,
  isLoading,
  isSaving,
  hasChanges,
  error,
  onChange,
  onSave
}: SettingsProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges || isSaving) {
      return;
    }
    await onSave();
  };

  if (isLoading || !preferences) {
    return (
      <section className={className}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2>Einstellungen</h2>
            <p>Modelle, Schlüssel und Design verwalten.</p>
          </div>
          <p className={styles.loading}>Einstellungen werden geladen…</p>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <form className={styles.container} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h2>Einstellungen</h2>
          <p>Passe Modelle, API-Schlüssel und Theme für dein Training an.</p>
        </div>

        <div className={styles.section}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="realtime-model">
              Realtime-Modell
            </label>
            <select
              id="realtime-model"
              className={styles.select}
              value={preferences.realtimeModel}
              onChange={(event) => onChange({ realtimeModel: event.target.value })}
            >
              {REALTIME_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className={styles.helper}>Bestimmt, welches Modell in der Live-Simulation genutzt wird.</p>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="responses-model">
              Bewertungsmodell
            </label>
            <select
              id="responses-model"
              className={styles.select}
              value={preferences.responsesModel}
              onChange={(event) => onChange({ responsesModel: event.target.value })}
            >
              {RESPONSES_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className={styles.helper}>Wird für die Analyse und das Score-Feedback verwendet.</p>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="api-key-override">
              Eigener OpenAI API Key (optional)
            </label>
            <input
              id="api-key-override"
              className={styles.input}
              type="password"
              placeholder="sk-..."
              value={preferences.apiKeyOverride ?? ''}
              onChange={(event) => onChange({ apiKeyOverride: event.target.value })}
            />
            <p className={styles.helper}>Wird nur für deine Sessions genutzt und sicher gespeichert.</p>
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.label}>Theme</span>
          <div className={styles.themeOptions}>
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.themeButton}
                data-active={preferences.theme === option.value}
                onClick={() => onChange({ theme: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className={styles.helper}>Wähle ein helles, dunkles oder systembasiertes Erscheinungsbild.</p>
        </div>

        <div className={styles.actions}>
          <p className={`${styles.statusText} ${error ? styles.errorText : ''}`}>
            {error ? error : hasChanges ? 'Änderungen noch nicht gespeichert.' : 'Alle Änderungen gespeichert.'}
          </p>
          <button className={styles.saveButton} type="submit" disabled={!hasChanges || isSaving}>
            {isSaving ? 'Speichern…' : 'Einstellungen speichern'}
          </button>
        </div>
      </form>
    </section>
  );
}
