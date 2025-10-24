import { useState, type FormEvent } from 'react';
import { PromptKey, type Prompt } from '../hooks/usePrompts';
import styles from './PromptEditor.module.css';

type PromptEditorProps = {
  prompt: Prompt | undefined;
  promptKey: PromptKey;
  title: string;
  description: string;
  isSaving: boolean;
  onSave: (key: PromptKey, value: string, description?: string) => Promise<void>;
};

export function PromptEditor({ prompt, promptKey, title, description, isSaving, onSave }: PromptEditorProps) {
  const [value, setValue] = useState(prompt?.value ?? '');
  const [promptDescription, setPromptDescription] = useState(prompt?.description ?? '');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    setHasChanges(newValue !== (prompt?.value ?? '') || promptDescription !== (prompt?.description ?? ''));
    setSaveError(null);
  };

  const handleDescriptionChange = (newDescription: string) => {
    setPromptDescription(newDescription);
    setHasChanges(value !== (prompt?.value ?? '') || newDescription !== (prompt?.description ?? ''));
    setSaveError(null);
  };

  const handleReset = () => {
    setValue(prompt?.value ?? '');
    setPromptDescription(prompt?.description ?? '');
    setHasChanges(false);
    setSaveError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges || isSaving) {
      return;
    }

    try {
      await onSave(promptKey, value, promptDescription || undefined);
      setHasChanges(false);
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Fehler beim Speichern');
    }
  };

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`prompt-${promptKey}`}>
          Prompt-Text
        </label>
        <textarea
          id={`prompt-${promptKey}`}
          className={styles.textarea}
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          rows={8}
          placeholder="Gib hier den Prompt-Text ein..."
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`description-${promptKey}`}>
          Beschreibung (optional)
        </label>
        <input
          id={`description-${promptKey}`}
          className={styles.input}
          type="text"
          value={promptDescription}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Kurze Beschreibung des Zwecks..."
        />
      </div>

      <div className={styles.actions}>
        <div className={styles.statusArea}>
          {saveError && <p className={styles.errorText}>{saveError}</p>}
          {hasChanges && !saveError && <p className={styles.statusText}>Nicht gespeicherte Änderungen</p>}
          {!hasChanges && !saveError && <p className={styles.successText}>Gespeichert</p>}
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.resetButton} onClick={handleReset} disabled={!hasChanges || isSaving}>
            Zurücksetzen
          </button>
          <button type="submit" className={styles.saveButton} disabled={!hasChanges || isSaving}>
            {isSaving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </form>
  );
}
