/** Editable Word (.docx) builders for delivered packages. Pure JS, Worker-safe. */
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { RESUME_TEMPLATES } from "../resume-templates";
import { safePhoto } from "../deliverable-doc";
import type { FullResume } from "./validate";

const FONT = "Calibri";
const run = (text: string, o: { bold?: boolean; size?: number; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 22, bold: o.bold ?? false, italics: o.italics ?? false });
const heading = (t: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 80 }, children: [run(t.toUpperCase(), { bold: true, size: 24 })] });

function photoParagraph(template: string, photo: string | null | undefined): Paragraph[] {
  const usesPhoto = RESUME_TEMPLATES.find((t) => t.id === template)?.usesPhoto ?? false;
  const p = usesPhoto ? safePhoto(photo) : null;
  if (!p) return [];
  const type = p.startsWith("data:image/png") ? "png" : "jpg";
  const bin = atob(p.slice(p.indexOf(",") + 1));
  const data = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type, data, transformation: { width: 96, height: 96 }, altText: { title: "Headshot", description: `${"Candidate"} headshot`, name: "photo" } })] })];
}

export function resumeDocxDocument(r: FullResume, opts: { template?: string; photo?: string | null } = {}): Document {
  const kids: Paragraph[] = [
    ...photoParagraph(opts.template ?? "classic", opts.photo),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(r.name, { bold: true, size: 36 })] }),
    ...(r.title ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(r.title, { size: 24 })] })] : []),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run([r.location, r.email, r.phone].filter(Boolean).join("  |  "), { size: 20 })] }),
  ];
  if (r.summary) kids.push(heading("Professional Summary"), new Paragraph({ children: [run(r.summary)] }));
  if (r.objective) kids.push(heading("Objective"), new Paragraph({ children: [run(r.objective)] }));
  if (r.experience.length) {
    kids.push(heading("Experience"));
    for (const e of r.experience) {
      kids.push(new Paragraph({ spacing: { before: 120 }, children: [run(e.role, { bold: true }), run(`  —  ${e.company}`), ...(e.location ? [run(`, ${e.location}`)] : [])] }));
      if (e.dates) kids.push(new Paragraph({ children: [run(e.dates, { italics: true, size: 20 })] }));
      for (const b of e.bullets) kids.push(new Paragraph({ bullet: { level: 0 }, children: [run(b)] }));
    }
  }
  if (r.education.length) {
    kids.push(heading("Education"));
    for (const e of r.education) kids.push(new Paragraph({ children: [run(e.credential, { bold: true }), run(`  —  ${e.school}`), ...(e.dates ? [run(`  (${e.dates})`)] : [])] }));
  }
  if (r.certifications.length) {
    kids.push(heading("Certifications"));
    for (const c of r.certifications) kids.push(new Paragraph({ bullet: { level: 0 }, children: [run([c.name, c.issuer, c.dates].filter(Boolean).join(" — "))] }));
  }
  if (r.skills.length) kids.push(heading("Skills"), new Paragraph({ children: [run(r.skills.join("  •  "))] }));
  return new Document({ creator: "Kay's Career Solutions", title: `${r.name} — Résumé`, sections: [{ children: kids }] });
}

export function letterDocxDocument(letter: string, r: FullResume): Document {
  const head = [r.name, [r.location, r.email, r.phone].filter(Boolean).join("  |  ")];
  return new Document({
    creator: "Kay's Career Solutions",
    title: `${r.name} — Cover Letter`,
    sections: [{
      children: [
        new Paragraph({ children: [run(head[0]!, { bold: true, size: 28 })] }),
        new Paragraph({ spacing: { after: 240 }, children: [run(head[1]!, { size: 20 })] }),
        ...letter.split(/\n\s*\n/).map((p) => new Paragraph({ spacing: { after: 200 }, children: p.split("\n").flatMap((line, i) => (i ? [new TextRun({ break: 1 }), run(line)] : [run(line)])) })),
      ],
    }],
  });
}

export async function toDocxBytes(doc: Document): Promise<ArrayBuffer> {
  const u = new Uint8Array(await Packer.toBuffer(doc));
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}
