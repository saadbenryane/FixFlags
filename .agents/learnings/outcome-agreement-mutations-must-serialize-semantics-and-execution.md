# Outcome agreement mutations must serialize semantics and execution

Confirming an Outcome changes two inseparable facts: the customer-visible promise and the execution binding FixFlags will run unattended. Putting both writes in one transaction prevents partial failure, but transaction atomicity alone does not prevent two valid requests from interleaving.

The durable mutation boundary is:

- acquire a tenant-scoped row lock for the Outcome before reading its kind, name, confirmation time or bindings;
- reject a requested kind when the locked Outcome is already a different known kind;
- canonicalize the name only when a generic inference first becomes an executable kind;
- treat a repeated same-kind confirmation as idempotent, preserving the customer label and original confirmation time;
- retire conflicting bindings, install the selected binding and update semantic identity in the same transaction;
- when confirmation is withdrawn, disable every active binding in that same serialized transaction;
- scope the lock itself by project or provisional Site, not only the later lookup, so a cross-tenant ID cannot create foreign lock contention.

Mocked transaction tests can prove which client receives each write, but they cannot prove database scheduling. The prevention fixture therefore also runs against local PostgreSQL: repeated confirmation/withdrawal races must end in either confirmed plus the matching enabled binding or unconfirmed plus no enabled binding. A separate contention case holds a foreign tenant row lock and proves the scoped request returns `null` without waiting or changing that row.
