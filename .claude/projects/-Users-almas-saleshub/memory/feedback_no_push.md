---
name: Confirm before pushing
description: Always confirm with the user before pushing to main — never push without explicit approval
type: feedback
---

Never push to main without explicit user confirmation. Ask "Shall I push?" and wait for approval.

**Why:** User explicitly requested this — they want control over when code goes to production.

**How to apply:** After committing, always ask before `git push`. The only exception is when the user says "push" or "yes" in response to the confirmation.
