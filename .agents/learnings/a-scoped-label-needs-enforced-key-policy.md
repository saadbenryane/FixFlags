# A scoped label needs an enforced key policy

The developer-key page called every key “scoped,” but UI-created and CLI-device keys had an empty scope list and no expiry. `credentialAllows` also treated every audience-less key as full access, even when it carried an explicit scope list. The label described the tenant boundary, not least privilege.

Prevent this class by giving every new key a named permission preset and bounded lifetime at creation, enforcing any non-empty scope set regardless of transport, and retaining empty-scope full access only as an explicit legacy compatibility case. List the access label and expiry beside the key so customers can audit what still acts for them. Count only unexpired keys against the active-key limit.

OAuth access tokens share the `ApiKey` table but are not developer keys. Developer-key inventory and quotas must filter to `audience: null`; otherwise a short-lived OAuth session can appear in the wrong settings surface or consume a developer-key slot.

An MCP client matrix should prove this boundary in the real client: a read-only key must receive `INSUFFICIENT_SCOPE`, an expired key must be rejected, and only a current full-workflow key may record or verify a fix.
