/**
 * Printable, self-contained cover letter documents in a few polished styles.
 * Pure module — safe to use on the client and inside server routes.
 */

export type CoverLetterStyle = "ivory" | "modern" | "blush";

export type CoverLetterStyleOption = {
  id: CoverLetterStyle;
  name: string;
  blurb: string;
  /** Swatches used for the picker chips. */
  swatch: [string, string];
};

export const COVER_LETTER_STYLES: CoverLetterStyleOption[] = [
  {
    id: "ivory",
    name: "Ivory Classic",
    blurb: "Warm cream stationery, serif headline, quiet gold rule.",
    swatch: ["#FBF7EF", "#B08A3E"],
  },
  {
    id: "modern",
    name: "Modern Slate",
    blurb: "Crisp white sheet with a slate sidebar for your contact details.",
    swatch: ["#FFFFFF", "#2F3E52"],
  },
  {
    id: "blush",
    name: "Blush Minimal",
    blurb: "Soft blush header block, generous spacing, rounded type.",
    swatch: ["#FDF1F1", "#C24B5A"],
  },
];

export type CoverLetterMeta = {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  jobLabel?: string;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(letter: string): string[] {
  return letter
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function contactLine(meta: CoverLetterMeta): string[] {
  return [meta.location, meta.email, meta.phone].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
}

/** Renders the cover letter as a styled, print-ready HTML document. */
export function renderCoverLetterHtml(
  letter: string,
  style: CoverLetterStyle,
  meta: CoverLetterMeta = {},
): string {
  const name = meta.name?.trim() || "";
  const title = meta.title?.trim() || "";
  const contacts = contactLine(meta);
  const body = paragraphs(letter)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n      ");
  const jobLine = meta.jobLabel?.trim()
    ? `<p class="re">Re: ${esc(meta.jobLabel.trim())}</p>`
    : "";

  const shared = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; }
    p { margin: 0 0 14px; }
    @page { margin: 0.6in; }
    @media print { body { padding: 0 !important; background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; } }
  `;

  if (style === "modern") {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(name || "Cover letter")} — Cover letter</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${shared}
  body { background: #eef1f5; padding: 32px 16px; font-family: Inter, Helvetica, Arial, sans-serif; color: #1d2733; line-height: 1.65; }
  .sheet { max-width: 820px; margin: 0 auto; background: #fff; display: grid; grid-template-columns: 240px 1fr; box-shadow: 0 18px 45px rgba(20,32,48,.14); }
  aside { background: #2f3e52; color: #eef2f7; padding: 40px 26px; }
  aside h1 { font-size: 22px; margin: 0 0 6px; letter-spacing: .01em; }
  aside .role { font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: #9db2cc; margin: 0 0 26px; }
  aside ul { list-style: none; margin: 0; padding: 0; font-size: 13px; }
  aside li { margin-bottom: 10px; word-break: break-word; }
  main { padding: 44px 42px; font-size: 15px; }
  .date { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #6b7a8d; margin-bottom: 22px; }
  .re { font-weight: 600; margin-bottom: 22px; color: #2f3e52; }
  @media (max-width: 640px) { .sheet { grid-template-columns: 1fr; } main { padding: 30px 24px; } }
</style></head>
<body><div class="sheet">
  <aside>
    ${name ? `<h1>${esc(name)}</h1>` : ""}
    ${title ? `<p class="role">${esc(title)}</p>` : ""}
    ${contacts.length ? `<ul>${contacts.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
  </aside>
  <main>
    <p class="date">${today()}</p>
    ${jobLine}
    ${body}
  </main>
</div></body></html>`;
  }

  if (style === "blush") {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(name || "Cover letter")} — Cover letter</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
<style>${shared}
  body { background: #f7efef; padding: 32px 16px; font-family: Nunito, Inter, Helvetica, Arial, sans-serif; color: #3b2b2e; line-height: 1.7; }
  .sheet { max-width: 760px; margin: 0 auto; background: #fff; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 40px rgba(120,60,70,.16); }
  header { background: #fdf1f1; padding: 38px 44px 30px; border-bottom: 3px solid #c24b5a; }
  header h1 { margin: 0; font-size: 28px; font-weight: 700; letter-spacing: .01em; }
  header .role { margin: 6px 0 0; font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #c24b5a; font-weight: 700; }
  header .contact { margin: 14px 0 0; font-size: 13px; color: #7a5f64; }
  main { padding: 36px 44px 46px; font-size: 15px; }
  .date { font-size: 13px; color: #9b7c81; margin-bottom: 20px; }
  .re { font-weight: 700; color: #c24b5a; margin-bottom: 20px; }
  @media (max-width: 640px) { header, main { padding-left: 24px; padding-right: 24px; } }
</style></head>
<body><div class="sheet">
  <header>
    ${name ? `<h1>${esc(name)}</h1>` : ""}
    ${title ? `<p class="role">${esc(title)}</p>` : ""}
    ${contacts.length ? `<p class="contact">${contacts.map(esc).join(" &nbsp;•&nbsp; ")}</p>` : ""}
  </header>
  <main>
    <p class="date">${today()}</p>
    ${jobLine}
    ${body}
  </main>
</div></body></html>`;
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(name || "Cover letter")} — Cover letter</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
<style>${shared}
  body { background: #f1ece1; padding: 32px 16px; font-family: Inter, Helvetica, Arial, sans-serif; color: #26221c; line-height: 1.7; }
  .sheet { max-width: 760px; margin: 0 auto; background: #fbf7ef; padding: 52px 56px 56px; box-shadow: 0 14px 38px rgba(60,50,30,.16); }
  h1 { font-family: "Cormorant Garamond", Georgia, serif; font-size: 34px; font-weight: 600; margin: 0; letter-spacing: .02em; }
  .role { margin: 6px 0 0; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: #b08a3e; }
  .contact { margin: 16px 0 0; font-size: 13px; color: #6a6152; }
  .rule { height: 2px; background: linear-gradient(90deg, #b08a3e, rgba(176,138,62,0)); margin: 26px 0 30px; }
  .date { font-size: 13px; color: #8a8271; margin-bottom: 20px; }
  .re { font-family: "Cormorant Garamond", Georgia, serif; font-size: 18px; margin-bottom: 20px; }
  main { font-size: 15px; }
  @media (max-width: 640px) { .sheet { padding: 32px 24px; } }
</style></head>
<body><div class="sheet">
  ${name ? `<h1>${esc(name)}</h1>` : ""}
  ${title ? `<p class="role">${esc(title)}</p>` : ""}
  ${contacts.length ? `<p class="contact">${contacts.map(esc).join(" &middot; ")}</p>` : ""}
  <div class="rule"></div>
  <main>
    <p class="date">${today()}</p>
    ${jobLine}
    ${body}
  </main>
</div></body></html>`;
}

export function isCoverLetterStyle(value: unknown): value is CoverLetterStyle {
  return value === "ivory" || value === "modern" || value === "blush";
}
