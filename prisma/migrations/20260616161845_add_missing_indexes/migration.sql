-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "expert_review_deliverables_orderId_idx" ON "expert_review_deliverables"("orderId");

-- CreateIndex
CREATE INDEX "expert_review_events_actorId_idx" ON "expert_review_events"("actorId");

-- CreateIndex
CREATE INDEX "expert_review_orders_auditId_idx" ON "expert_review_orders"("auditId");

-- CreateIndex
CREATE INDEX "processed_stripe_events_type_idx" ON "processed_stripe_events"("type");

-- CreateIndex
CREATE INDEX "processed_stripe_events_processedAt_idx" ON "processed_stripe_events"("processedAt");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "verifications_expiresAt_idx" ON "verifications"("expiresAt");
