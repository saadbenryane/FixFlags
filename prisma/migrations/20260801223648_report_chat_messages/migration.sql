-- CreateTable
CREATE TABLE "report_chat_messages" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_chat_messages_auditId_createdAt_idx" ON "report_chat_messages"("auditId", "createdAt" ASC);

-- CreateIndex
CREATE INDEX "report_chat_messages_userId_idx" ON "report_chat_messages"("userId");

-- AddForeignKey
ALTER TABLE "report_chat_messages" ADD CONSTRAINT "report_chat_messages_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_chat_messages" ADD CONSTRAINT "report_chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
