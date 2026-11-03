# ETHAN CBT v0.2.1 — deployment checklist

## Before deployment
- [ ] Confirm `config.js` points to project `juumaqmkcmfpexgpzpfy`.
- [ ] Confirm only the publishable key is present in browser code.
- [ ] Confirm no service-role or secret key is present in the repository.
- [ ] Enable leaked-password protection in Supabase Auth.
- [ ] Configure Supabase Site URL and allowed redirect URLs for the final domain and any required preview URLs.
- [ ] Decide candidate signup policy. If self-signup is enabled, unassigned users must remain without institution membership until approved.
- [ ] Verify owner account can authenticate.

## Vercel
- [ ] Create a new GitHub repository named `ethan-cbt` (or another approved repository name).
- [ ] Upload the extracted contents of this package to the repository root; do not upload the ZIP file itself.
- [ ] Import the repository into Vercel.
- [ ] Framework preset: Other / Static.
- [ ] Build command: blank.
- [ ] Output directory: `.`.
- [ ] Add `cbt.ethandigitalacademy.org` as the custom domain.
- [ ] Configure DNS records exactly as Vercel specifies.
- [ ] Wait for HTTPS to become active.

## Administrator tests
- [ ] Owner can sign in and see the live dashboard.
- [ ] Sign out appears in top bar and sidebar and returns to login.
- [ ] Password reset email arrives and password update completes.
- [ ] Owner can create a subject and question bank.
- [ ] Owner can create single-choice, multi-select, true/false, short-answer, fill-blank and essay questions.
- [ ] Verify answer keys are not directly readable by candidate accounts.
- [ ] Create an exam with published questions; test draft-to-published transition.
- [ ] Add candidate account, assign candidate role and assign a published examination.
- [ ] Test examiner manual marking and owner/admin result release.

## Candidate tests
- [ ] Candidate can register/sign in and sees no institution data before assignment.
- [ ] Candidate sees only assigned examinations.
- [ ] Begin exam creates a server-side session and deadline.
- [ ] Candidate receives randomized session question/option order when enabled.
- [ ] Choice answers save after selection; written answers save after a short debounce.
- [ ] Rapid question navigation does not lose another question’s pending save.
- [ ] Manual submission waits for all answered questions to save or clearly blocks with a connection warning.
- [ ] Refresh/reconnect restores the active session and saved answers.
- [ ] Server rejects answers after deadline and submits the session.
- [ ] Candidate cannot directly read answer keys or other candidates' answers.
- [ ] Candidate cannot see score before results are released.
- [ ] Candidate can see only their own published results.

## Security and integrity
- [ ] Confirm RLS remains enabled on all public tables.
- [ ] Re-run Supabase Security Advisor after settings changes.
- [ ] Review all authenticated `SECURITY DEFINER` warnings and re-check each function's caller/role/session guards.
- [ ] Test owner/admin/question_setter/invigilator/examiner/candidate permissions separately.
- [ ] Test browser tab-change and network events; do not treat an event as proof of misconduct.
- [ ] Load test concurrent candidates and autosave traffic before large examinations.
- [ ] Perform a separate security review before high-stakes or external examinations.
