-- Measured overlay targets for a Flag (top-left 0-1 rects bound to a capture device).
ALTER TABLE "flags" ADD COLUMN "evidenceTargets" JSONB;
