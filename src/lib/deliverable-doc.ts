import type { ResumeData } from "./resume-templates";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A self-contained, printable HTML document for the finished résumé.
 * Opens in any browser and prints straight to PDF — no app session needed.
 */
export function renderResumeDocument(resume: ResumeData): string {
  const contact = [resume.location, resume.email, resume.phone]
    .filter((part) => Boolean(part && part.trim()))
    .map(esc)
    .join(" &middot; ");

  const experience = resume.experience
    .map(
      (job) => `
      <article class="entry">
        <h3>${esc(job.role ?? "")}</h3>
        <p class="meta">${esc([job.company, job.location].filter(Boolean).join(" — "))}${
          job.period ? ` &middot; ${esc(job.period)}` : ""
        }</p>
        <ul>${(job.bullets ?? []).map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul>
      </article>`,
    )
    .join("");

  const education = resume.education
    .map(
      (item) => `
      <article class="entry">
        <h3>${esc(item.credential ?? "")}</h3>
        <p class="meta">${esc([item.school, item.period].filter(Boolean).join(" — "))}</p>
      </article>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(resume.name || "Résumé")} — Résumé</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 48px 40px; font-family: Inter, Helvetica, Arial, sans-serif; color: #14213d; background: #ffffff; line-height: 1.55; }
  .sheet { max-width: 760px; margin: 0 auto; }
  h1 { margin: 0; font-size: 30px; letter-spacing: 0.02em; }
  .title { margin: 6px 0 0; font-size: 15px; color: #d6001c; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .contact { margin: 10px 0 0; font-size: 13px; color: #4b5563; }
  h2 { margin: 34px 0 12px; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; border-bottom: 2px solid #d6001c; padding-bottom: 6px; }
  .entry { margin-bottom: 18px; }
  .entry h3 { margin: 0; font-size: 15px; }
  .meta { margin: 2px 0 6px; font-size: 13px; color: #4b5563; }
  ul { margin: 0; padding-left: 20px; font-size: 14px; }
  li { margin-bottom: 4px; }
  .skills { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; margin: 0; list-style: none; font-size: 13px; }
  .skills li { border: 1px solid #14213d; padding: 3px 10px; border-radius: 999px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="sheet">
    <h1>${esc(resume.name || "")}</h1>
    ${resume.title ? `<p class="title">${esc(resume.title)}</p>` : ""}
    ${contact ? `<p class="contact">${contact}</p>` : ""}
    ${resume.summary ? `<h2>Summary</h2><p>${esc(resume.summary)}</p>` : ""}
    ${resume.objective ? `<h2>Objective</h2><p>${esc(resume.objective)}</p>` : ""}
    ${experience ? `<h2>Experience</h2>${experience}` : ""}
    ${education ? `<h2>Education</h2>${education}` : ""}
    ${
      resume.skills.length
        ? `<h2>Skills</h2><ul class="skills">${resume.skills
            .map((skill) => `<li>${esc(skill)}</li>`)
            .join("")}</ul>`
        : ""
    }
  </div>
</body>
</html>`;
}

/** The cover letter as a plain text file. */
export function renderCoverLetterDocument(letter: string): string {
  return letter.replace(/\r?\n/g, "\r\n");
}

export function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}
