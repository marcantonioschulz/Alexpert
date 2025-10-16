-- CreateEnum
CREATE TYPE "ConversationLogType" AS ENUM ('TRANSCRIPT', 'AI_FEEDBACK', 'SCORING_CONTEXT');

-- CreateTable
CREATE TABLE "ConversationLog" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "type" "ConversationLogType" NOT NULL,
    "content" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConversationLog"
  ADD CONSTRAINT "ConversationLog_conversationId_fkey"
  FOREIGN KEY ("conversationId")
  REFERENCES "Conversation"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
