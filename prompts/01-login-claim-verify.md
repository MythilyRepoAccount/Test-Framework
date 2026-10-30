# 01: Login, claim, verify

**Attached:** `candidate_assessment_brief.md` (the Chubb brief) and the app's setup `README.md`.

**Prompt:**
> understand the framework this the framework given for clinet calll screening , and my req is to complete the login , claim , and verify

**Outcome:** the existing claim test stopped at submit and re-typed step 1 after Back. It was rebuilt to check the claim on the Review step, in the toast, in the My Claims row, in Claim Details and through the BFF API. This exposed D4 (Back blanks the date) and D1 (timezone shift). Running the suite also surfaced D3 (lockout reported as invalid credentials).
