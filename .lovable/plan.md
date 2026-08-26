# Customer Intake Forms — Kay's Career Solutions

Build three service-specific intake forms with a review-then-submit step. No payments, no emails, no AI, no admin dashboard in this step. The existing template/AI flow stays exactly as it is and runs after the intake is submitted.

## Flow

```text
Pricing tier clicked
  -> /order/<tier>  (NEW: Step 1 = intake form for that service)
  -> REVIEW ORDER   (read-only summary of everything entered)
  -> SUBMIT ORDER   (saved to database + files stored)
  -> existing flow continues (template pick -> photo -> generation)
```

The form fields shown are driven entirely by the selected service, so no customer ever sees irrelevant questions.

## $40 — Resume Revamp

Not job-specific. No target job, career field, company, job posting, or job description fields anywhere on this form.

- First and last name — required
- Email — required
- Phone — required
- Current resume upload — required
- Additional information/instructions — optional

## $50 — Résumé From Scratch

No resume upload required (and none requested).

- First and last name, Email, Phone — required
- Target job title — required
- Target career field — optional
- Work history — required (repeatable entries: job title, employer, dates, responsibilities/accomplishments)
- Education — required (repeatable entries: school, credential, dates)
- Skills — required
- Certifications — optional
- Additional professional experience — optional
- Additional information/instructions — optional

## $60 — Revamp + ATS Optimization

Shows the notice: "This package includes tailoring your resume to ONE specific job posting."

- First and last name, Email, Phone — required
- Current resume upload — required
- Target job title — required
- Target career field — optional
- Company name — required
- Specific job title — required
- Job posting URL — optional
- Full job description — required *unless* a job posting file is uploaded
- Job posting upload — optional
- Additional information/instructions — optional

Submission is blocked until the job description text OR a job posting upload is present, with a clear inline message explaining which is missing.

## Confirmation, review, submit

- A required checkbox above the review button: "I confirm that the information I provided is accurate and that I have provided all required information and documents for my selected service."
- REVIEW ORDER button validates everything and moves to a read-only summary listing every answer, uploaded filenames, and the service + price. An "Edit answers" link returns to the form with all values intact.
- SUBMIT ORDER on the review screen saves the intake, then continues into the existing template/photo/generation flow.

## Uploads

- Accepted: PDF, DOC, DOCX (resume and job posting).
- Max size 10 MB per file, validated by extension and MIME type with friendly errors.
- Files are uploaded to a private storage bucket at submit time; only the owner service (server side) can read them.

## Validation and UX

- Inline per-field errors on blur and on review attempt; the first invalid field is scrolled into view and focused.
- Email format and phone format checks; long text fields have character limits.
- Single-column mobile-first layout, large tap targets, existing dark gold/crimson brand styling, typewriter headers and Inter body text.

## Technical notes

- New `src/lib/intake-schema.ts` with a Zod schema per tier (shared base + tier-specific extensions) used by both the client form and the server submit function.
- New `src/components/intake/` — `IntakeForm.tsx` (renders fields from the tier config), `RepeatableList.tsx` (work history / education entries), `IntakeReview.tsx` (read-only summary), `FileField.tsx` (type/size validation).
- `src/routes/order.$tier.tsx` gains a leading `intake` phase; existing phases (`layout`, `confirm`, `done`) and the ref-based file/email fallbacks are preserved untouched.
- Database: new `public.intakes` table (id, tier, submitted_at, contact fields, tier-specific JSONB `answers`, resume/job file paths, confirmation flag). RLS enabled; no anon or authenticated read access — writes and reads happen through server functions with the service role, so customer data is not publicly readable. Migration includes GRANTs to `service_role`.
- New private storage bucket `intake-uploads` with no public policies; uploads go through a server function.
- New `src/lib/intake.functions.ts` (`submitIntake` server fn) + `src/lib/intake.server.ts` for the insert/upload helpers.
- No changes to payments, mailers, AI prompts, or the deliverable renderers.

## Testing before reporting done

Playwright run per tier: open each tier page, confirm the $40 form shows no job fields, the $50 form shows no resume upload, and the $60 form blocks submit without job description or upload; then complete each form, verify the review screen shows the entered values, submit, and confirm the row and uploaded files exist in the backend. Mobile viewport screenshots for all three.
