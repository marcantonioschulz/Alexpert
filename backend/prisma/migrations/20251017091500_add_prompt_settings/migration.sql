-- CreateTable
CREATE TABLE "PromptSetting" (
    "id" SERIAL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default prompts
INSERT INTO "PromptSetting" ("key", "value", "description") VALUES
  (
    'realtime_system_prompt',
    $$Du bist ein empathischer, deutschsprachiger Vertriebscoach. Führe ein natürliches Gespräch, biete gezielte Hilfestellungen und bleibe stets professionell. $$,
    'Systemprompt für die Echtzeit-Sprachsession'
  ),
  (
    'realtime_role_prompt',
    $$Der Nutzer trainiert ein Verkaufsgespräch. Stelle Rückfragen, erkenne Bedürfnisse und liefere Antworten in natürlicher Sprache.$$,
    'Rollenbeschreibung für das Voice-Coaching'
  ),
  (
    'scoring_prompt',
    $$Bewerte dieses Verkaufsgespräch nach Klarheit, Bedarfsermittlung, Nutzenargumentation und Einwandbehandlung. Antworte ausschließlich als JSON im Format {"score": number, "feedback": string}. Score muss zwischen 0 und 100 liegen.$$,
    'Bewertungslogik für GPT-Auswertung'
  )
ON CONFLICT ("key") DO NOTHING;
