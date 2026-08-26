import type { ResumeData, TemplateId } from "./resume-templates";

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
export function renderResumeDocument(resume: ResumeData, selectedTemplate = "classic"): string {
  const allowedTemplates: TemplateId[] = [
    "sidebar",
    "timeline",
    "classic",
    "timeline-forest",
    "timeline-charcoal",
    "sidebar-teal",
    "navy-gold",
  ];
  const template: TemplateId = allowedTemplates.includes(selectedTemplate as TemplateId)
    ? (selectedTemplate as TemplateId)
    : "classic";
  const contact = [resume.location, resume.email, resume.phone]
    .filter((part) => Boolean(part && part.trim()))
    .map(esc)
    .join(" &middot; ");

  const experience = resume.experience
    .map(
      (job) => `
      <article class="entry">
        <div class="date-box">${esc(job.dates ?? "")}</div>
        <div class="entry-copy">
        <h3>${esc(job.role ?? "")}</h3>
        <p class="meta">${esc([job.company, job.location].filter(Boolean).join(" — "))}${
          template === "timeline-forest" || template === "timeline-charcoal" ? "" : job.dates ? ` &middot; ${esc(job.dates)}` : ""
        }</p>
        <ul>${(job.bullets ?? []).map((bullet) => `<li>${esc(bullet)}</li>`).join("")}</ul>
        </div>
      </article>`,
    )
    .join("");

  const education = resume.education
    .map(
      (item) => `
      <article class="entry">
        <h3>${esc(item.credential ?? "")}</h3>
        <p class="meta">${esc([item.school, item.dates].filter(Boolean).join(" — "))}</p>
      </article>`,
    )
    .join("");

  const theme =
    template === "timeline-forest"
      ? { band: "#183d35", accent: "#b96f3e", soft: "#f2e3d8" }
      : template === "timeline-charcoal"
        ? { band: "#242424", accent: "#4d7fa8", soft: "#e4eef6" }
        : template === "sidebar-teal"
          ? { band: "#0b6967", accent: "#0b6967", soft: "#e2f0ef" }
          : template === "navy-gold"
            ? { band: "#1b2a4a", accent: "#b38a2d", soft: "#f4eedc" }
            : { band: "#ffffff", accent: "#d6001c", soft: "#f3f3f3" };

  const skills = resume.skills.map((skill) => `<li>${esc(skill)}</li>`).join("");
  const sidebar = template === "sidebar-teal"
    ? `<aside class="sidebar">
        <h1>${esc(resume.name || "")}</h1>
        ${resume.title ? `<p class="side-title">${esc(resume.title)}</p>` : ""}
        <h2>Contact</h2><p>${[resume.location, resume.phone, resume.email].filter(Boolean).map(esc).join("<br>")}</p>
        ${skills ? `<h2>Competencies</h2><ul>${skills}</ul>` : ""}
        ${education ? `<h2>Education</h2>${education}` : ""}
      </aside>`
    : "";

  const header = template === "sidebar-teal"
    ? ""
    : `<header>
        <h1>${esc(resume.name || "")}</h1>
        ${resume.title ? `<p class="title">${esc(resume.title)}</p>` : ""}
        ${contact ? `<p class="contact">${contact}</p>` : ""}
      </header>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(resume.name || "Résumé")} — Résumé</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  @page { size: letter; margin: 0; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #202020; background: #ffffff; line-height: 1.4; }
  .sheet { width: 8.5in; min-height: 11in; margin: 0 auto; background: #fff; }
  .main { padding: 28px 38px 38px; }
  header { background: ${theme.band}; padding: 27px 36px 25px; color: ${template === "classic" ? "#202020" : "#ffffff"}; ${template === "navy-gold" ? "text-align:center;" : ""} }
  h1 { margin: 0; font-size: 25px; letter-spacing: 0.02em; text-transform: uppercase; }
  .title { margin: 4px 0 0; font-size: 11px; color: ${theme.accent}; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .contact { margin: 6px 0 0; font-size: 9px; color: ${template === "classic" ? "#555" : "rgba(255,255,255,.86)"}; }
  h2 { margin: 20px 0 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; border-bottom: ${template === "navy-gold" ? `2px solid ${theme.accent}` : "0"}; padding: 0 0 4px 14px; position: relative; }
  h2:before { content: ""; position: absolute; left: 0; top: 1px; width: 4px; height: 13px; background: ${theme.accent}; }
  p { font-size: 10px; margin: 0; }
  .entry { margin-bottom: 14px; display: flex; gap: 14px; }
  .entry-copy { flex: 1; min-width: 0; }
  .date-box { display: ${template === "timeline-forest" || template === "timeline-charcoal" ? "block" : "none"}; width: 90px; flex: 0 0 90px; align-self: stretch; padding: 10px; color: ${theme.accent}; background: ${theme.soft}; font-size: 9px; font-weight: 700; white-space: pre-line; }
  .entry h3 { margin: 0; font-size: 15px; }
  .meta { margin: 2px 0 5px; font-size: 9px; color: #666; font-style: italic; }
  ul { margin: 0; padding-left: 16px; font-size: 9px; }
  li { margin-bottom: 3px; }
  .skills { display: ${template === "navy-gold" ? "grid" : "flex"}; grid-template-columns: 1fr 1fr; flex-wrap: wrap; gap: 4px 18px; padding: ${template === "timeline-forest" || template === "timeline-charcoal" ? "10px 14px" : "0 0 0 16px"}; margin: 0; list-style: ${template === "navy-gold" ? "disc" : "none"}; font-size: 9px; background: ${template === "timeline-forest" || template === "timeline-charcoal" ? theme.band : "transparent"}; color: ${template === "timeline-forest" || template === "timeline-charcoal" ? "#fff" : "inherit"}; }
  .sidebar-layout { display: flex; min-height: 11in; }
  .sidebar { width: 31%; flex: 0 0 31%; padding: 32px 24px; background: ${theme.band}; color: #fff; }
  .sidebar h1 { font-size: 21px; text-transform: none; }
  .sidebar .side-title { margin-top: 5px; font-size: 9px; text-transform: uppercase; color: rgba(255,255,255,.84); }
  .sidebar h2 { margin-top: 25px; padding-left: 0; border: 0; color: #fff; }
  .sidebar h2:before { display: none; }
  .sidebar p, .sidebar li, .sidebar .meta { color: rgba(255,255,255,.9); font-size: 9px; }
  .sidebar .entry { display: block; }
  .sidebar-layout > .main { width: 69%; padding: 30px 32px; }
  .sidebar-layout > .main h2 { color: ${theme.accent}; border-bottom: 1px solid ${theme.accent}; padding-left: 0; }
  .sidebar-layout > .main h2:before { display: none; }
  .sidebar-layout > .main .entry { display: block; }
  @media print { .sheet { margin: 0; } }
  @media screen and (max-width: 850px) { .sheet { width: 100%; } }
</style>
</head>
<body>
  <div class="sheet ${template === "sidebar-teal" ? "sidebar-layout" : ""}">
    ${sidebar}
    <div class="${template === "sidebar-teal" ? "main" : ""}">
      ${header}
      <div class="${template === "sidebar-teal" ? "" : "main"}">
        ${resume.summary ? `<h2>Professional Summary</h2><p>${esc(resume.summary)}</p>` : ""}
        ${resume.objective ? `<h2>Objective</h2><p>${esc(resume.objective)}</p>` : ""}
        ${resume.skills.length && template !== "sidebar-teal" ? `<h2>Core Competencies</h2><ul class="skills">${skills}</ul>` : ""}
        ${experience ? `<h2>Professional Experience</h2>${experience}` : ""}
        ${education && template !== "sidebar-teal" ? `<h2>Education</h2>${education}` : ""}
      </div>
    </div>
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
