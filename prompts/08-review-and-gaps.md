# 08: Review against the brief, then close the gaps

**Prompts:**
> kindly confirm the framwork is ok for client based on criteria . check the framework will work fine

> 1,2, 3,4   *(go ahead with all four recommended fixes)*

**Review outcome:** a fresh-clone install, typecheck and smoke run took 62s. A back-to-back full run failed on a Keycloak lockout (D3). Gaps against the brief: no unit or component tests, no git history, and the journal sign-off not yet filled in.

**Fixes:**
1. `workers: 1`, plus `claim-ownership.spec.ts`, which reproduces D6 deliberately (20 concurrent claims per user, plus a sequential control). It failed 5 of 5 runs while the control passed 5 of 5. The database showed claims stored under the **other** user. It also found D7 (a 500 on reading another user's claim) and the CSRF-rotation observation.
2. 42 Vitest unit and component tests in `demo-app-ui/tests/`, with D1 and D4 pinned as `it.fails`. Each was checked to fail for the right reason.
3. A git repository with commits by area.
4. The journal updated; the sign-off decisions confirmed with the candidate.
