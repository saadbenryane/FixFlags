-- Recheck reasons are shown to owners in verification history. Earlier attempts
-- stored internal wording ("update Review", "exact verifier"); rewrite exactly
-- those retired strings to the current Recheck wording. Other text is untouched.
UPDATE "improvement_attempts" SET "verificationReason" = CASE "verificationReason"
  WHEN 'The update Review did not establish the original finding’s verification scope.' THEN 'The recheck could not confirm what the original Flag covered.'
  WHEN 'The update Review was partial or incomplete.' THEN 'The recheck was partial or incomplete.'
  WHEN 'The update Review did not capture comparable evidence.' THEN 'The recheck did not capture evidence comparable to the original.'
  WHEN 'The update Review did not complete the affected page.' THEN 'The recheck did not finish the affected page.'
  WHEN 'The exact applicable verifier failed.' THEN 'The same check failed to run in the recheck.'
  WHEN 'The exact verifier was not applicable to the captured scope.' THEN 'The same check did not apply to what the recheck captured.'
  WHEN 'The update Review has no positive execution record for the exact verifier and scope.' THEN 'The recheck has no completed result for the same check and scope.'
  WHEN 'The exact verifier completed without a durable evidence reference.' THEN 'The same check finished without recorded evidence.'
  WHEN 'The applicable journey verification did not complete.' THEN 'The visitor journey in the recheck did not finish.'
  WHEN 'The applicable AI assessment did not complete.' THEN 'The AI assessment in the recheck did not finish.'
  WHEN 'The applicable verifier did not complete.' THEN 'The check in the recheck did not finish.'
  WHEN 'The fresh update Review completed comparable verification coverage.' THEN 'The recheck covered the same page and check as the original Flag.'
  WHEN 'The update Review did not retain the original selected repair scope.' THEN 'The recheck did not keep the original repair scope.'
  WHEN 'The original AI observation has no stable evidence fingerprint for comparison.' THEN 'The original AI observation has no stable fingerprint to compare.'
  WHEN 'The update Review did not identify a comparable continuation of the original finding.' THEN 'The recheck could not match this Flag to the original finding.'
  ELSE "verificationReason" END
WHERE "verificationReason" IN (
  'The update Review did not establish the original finding’s verification scope.',
  'The update Review was partial or incomplete.',
  'The update Review did not capture comparable evidence.',
  'The update Review did not complete the affected page.',
  'The exact applicable verifier failed.',
  'The exact verifier was not applicable to the captured scope.',
  'The update Review has no positive execution record for the exact verifier and scope.',
  'The exact verifier completed without a durable evidence reference.',
  'The applicable journey verification did not complete.',
  'The applicable AI assessment did not complete.',
  'The applicable verifier did not complete.',
  'The fresh update Review completed comparable verification coverage.',
  'The update Review did not retain the original selected repair scope.',
  'The original AI observation has no stable evidence fingerprint for comparison.',
  'The update Review did not identify a comparable continuation of the original finding.'
);

UPDATE "improvement_attempts"
SET "verificationReason" = regexp_replace("verificationReason", '^The update Review was degraded because these modules failed: ', 'The recheck was incomplete because these checks failed: ')
WHERE "verificationReason" LIKE 'The update Review was degraded because these modules failed: %';
