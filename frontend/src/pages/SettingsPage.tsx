import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { usePrompts, PromptKey } from '../hooks/usePrompts';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { PromptEditor } from '../components/PromptEditor';
import type { ThemePreference, UserPreferences } from '../types/preferences';
import styles from './SettingsPage.module.css';

type TabType = 'user' | 'prompts' | 'advanced';

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

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('user');
  const { user } = useUser();
  const userId = user?.id || 'demo-user'; // Fallback to demo-user for backward compatibility

  const {
    preferences,
    updatePreference,
    savePreferences,
    isLoading: isPreferencesLoading,
    isSaving: isPreferencesSaving,
    error: preferencesError,
    hasChanges: preferencesChanged
  } = useUserPreferences(userId);

  const { isLoading: isPromptsLoading, error: promptsError, isSaving: isPromptsSaving, updatePrompt, getPrompt } = usePrompts();

  const handlePreferenceChange = (update: Partial<UserPreferences>) => {
    updatePreference(update);
  };

  const handleSavePreferences = async () => {
    await savePreferences();
  };

  const handleSavePrompt = async (key: PromptKey, value: string, description?: string) => {
    await updatePrompt(key, value, description);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <Link to="/" className={styles.backLink}>
            ← Zurück
          </Link>
          <div>
            <h1>Einstellungen</h1>
            <p>Verwalte deine Benutzereinstellungen, Prompts und erweiterte Optionen</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <nav className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'user' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('user')}
          >
            Benutzereinstellungen
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'prompts' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('prompts')}
          >
            Prompt-Management
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'advanced' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Erweiterte Optionen
          </button>
        </nav>

        <div className={styles.content}>
          {activeTab === 'user' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <h2>Benutzereinstellungen</h2>
                <p className={styles.cardDescription}>
                  Passe Modelle, API-Schlüssel und Theme für dein Training an.
                </p>

                {isPreferencesLoading || !preferences ? (
                  <p className={styles.loading}>Einstellungen werden geladen…</p>
                ) : (
                  <form
                    className={styles.form}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSavePreferences();
                    }}
                  >
                    <div className={styles.section}>
                      <h3 className={styles.sectionTitle}>Modelle</h3>

                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="realtime-model">
                          Realtime-Modell
                        </label>
                        <select
                          id="realtime-model"
                          className={styles.select}
                          value={preferences.realtimeModel}
                          onChange={(e) => handlePreferenceChange({ realtimeModel: e.target.value })}
                        >
                          {REALTIME_MODEL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className={styles.helper}>
                          Bestimmt, welches Modell in der Live-Simulation genutzt wird.
                        </p>
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="responses-model">
                          Bewertungsmodell
                        </label>
                        <select
                          id="responses-model"
                          className={styles.select}
                          value={preferences.responsesModel}
                          onChange={(e) => handlePreferenceChange({ responsesModel: e.target.value })}
                        >
                          {RESPONSES_MODEL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className={styles.helper}>
                          Wird für die Analyse und das Score-Feedback verwendet.
                        </p>
                      </div>
                    </div>

                    <div className={styles.section}>
                      <h3 className={styles.sectionTitle}>API-Schlüssel</h3>

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
                          onChange={(e) => handlePreferenceChange({ apiKeyOverride: e.target.value })}
                        />
                        <p className={styles.helper}>
                          Wird nur für deine Sessions genutzt und sicher gespeichert.
                          <br />
                          <strong>Wichtig:</strong> Dein API-Schlüssel muss Zugriff auf die OpenAI Realtime API haben.
                          Überprüfe deine Berechtigungen unter{' '}
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            platform.openai.com
                          </a>
                          .
                        </p>
                      </div>
                    </div>

                    <div className={styles.section}>
                      <h3 className={styles.sectionTitle}>Erscheinungsbild</h3>

                      <div className={styles.fieldGroup}>
                        <span className={styles.label}>Theme</span>
                        <div className={styles.themeOptions}>
                          {THEME_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={styles.themeButton}
                              data-active={preferences.theme === option.value}
                              onClick={() => handlePreferenceChange({ theme: option.value })}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p className={styles.helper}>
                          Wähle ein helles, dunkles oder systembasiertes Erscheinungsbild.
                        </p>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <p className={`${styles.statusText} ${preferencesError ? styles.errorText : ''}`}>
                        {preferencesError
                          ? preferencesError
                          : preferencesChanged
                            ? 'Änderungen noch nicht gespeichert.'
                            : 'Alle Änderungen gespeichert.'}
                      </p>
                      <button
                        className={styles.saveButton}
                        type="submit"
                        disabled={!preferencesChanged || isPreferencesSaving}
                      >
                        {isPreferencesSaving ? 'Speichern…' : 'Einstellungen speichern'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <h2>Prompt-Management</h2>
                <p className={styles.cardDescription}>
                  Verwalte die Prompts für die KI-Agenten und die Bewertungslogik.
                </p>

                {isPromptsLoading ? (
                  <p className={styles.loading}>Prompts werden geladen…</p>
                ) : promptsError ? (
                  <p className={styles.error}>{promptsError}</p>
                ) : (
                  <div className={styles.promptsList}>
                    <PromptEditor
                      prompt={getPrompt(PromptKey.REALTIME_SYSTEM)}
                      promptKey={PromptKey.REALTIME_SYSTEM}
                      title="System-Prompt (Realtime)"
                      description="Legt das Verhalten und die Grundregeln für die KI in der Realtime-Konversation fest."
                      isSaving={isPromptsSaving}
                      onSave={handleSavePrompt}
                    />

                    <PromptEditor
                      prompt={getPrompt(PromptKey.REALTIME_ROLE)}
                      promptKey={PromptKey.REALTIME_ROLE}
                      title="Rollen-Prompt (Realtime)"
                      description="Definiert die Rolle und Persönlichkeit, die die KI während des Gesprächs einnimmt."
                      isSaving={isPromptsSaving}
                      onSave={handleSavePrompt}
                    />

                    <PromptEditor
                      prompt={getPrompt(PromptKey.SCORING)}
                      promptKey={PromptKey.SCORING}
                      title="Bewertungs-Prompt"
                      description="Bestimmt, wie die KI das Verkaufsgespräch bewertet und welche Kriterien sie anwendet."
                      isSaving={isPromptsSaving}
                      onSave={handleSavePrompt}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className={styles.tabContent}>
              <div className={styles.card}>
                <h2>Erweiterte Optionen</h2>
                <p className={styles.cardDescription}>
                  Zusätzliche Konfigurationsoptionen für fortgeschrittene Benutzer.
                </p>
                <p className={styles.comingSoon}>
                  Weitere Optionen wie Sprachauswahl, Audioformat und erweiterte Parameter folgen in einem zukünftigen
                  Update.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
