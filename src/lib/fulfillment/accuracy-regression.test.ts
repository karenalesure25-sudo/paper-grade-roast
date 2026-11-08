import { describe, expect, test } from "bun:test";
import { placeholderKind, validatePackage, type FullResume, type SourceFacts } from "./validate";

// Synthetic source shaped like the failed test order (fictional person, test-style contact details).
const SOURCE = `Alex Rivera
alex.test@example.com · (614) 555-0142 · Columbus, OH
Experience
Warehouse Associate, Northgate Distribution (fictional), 2021–Present
Picked and packed 180+ orders per shift with 99.6% accuracy.
Trained 6 new associates on RF scanner workflows.
Reduced aisle restock time by 15% by reorganizing bin labels.
Stock Clerk, Maple Market (fictional), 2019–2021
Received and checked 40 pallets weekly against invoices.
Education
High School Diploma, Westfield High School (fictional), 2019
Skills
RF scanners, forklift certified, inventory counts, WMS`;

const facts: SourceFacts = {
  tier: "revamp", text: SOURCE, name: "Alex Rivera", email: "alex.test@example.com", phone: "(614) 555-0142",
  requiredEmployers: [], requiredSchools: [], requiredCertifications: [],
};

const faithful = (): FullResume => ({
  name: facts.name, email: facts.email, phone: facts.phone,
  title: "Warehouse Associate", location: "Columbus, OH", objective: "",
  summary: "Warehouse associate experienced in picking, packing and receiving, training new associates and improving restock workflows with RF scanners and WMS.",
  experience: [
    { company: "Northgate Distribution", role: "Warehouse Associate", location: "", dates: "2021–Present",
      bullets: ["Picked and packed 180+ orders per shift at 99.6% accuracy.", "Trained 6 new associates on RF scanner workflows.", "Cut aisle restock time 15% by reorganizing bin labels."] },
    { company: "Maple Market", role: "Stock Clerk", location: "", dates: "2019–2021",
      bullets: ["Received and verified 40 pallets weekly against invoices."] },
  ],
  education: [{ school: "Westfield High School", credential: "High School Diploma", dates: "2019" }],
  skills: ["RF scanners", "Forklift certified", "Inventory counts", "WMS"],
  certifications: [],
});

const codes = (r: FullResume) => validatePackage({ resume: r }, facts).map((v) => v.code);

describe("accuracy checks on the failed test-order shape", () => {
  test("a faithful rewrite passes, including example.com / 555 contact details in the contact fields", () => {
    expect(validatePackage({ resume: faithful() }, facts)).toEqual([]);
  });
  test("coined headline is still rejected as invented_title", () => {
    expect(codes({ ...faithful(), title: "Warehouse Operations Professional" })).toContain("invented_title");
  });
  test("computed years of experience are still rejected as invented_metric", () => {
    expect(codes({ ...faithful(), summary: faithful().summary + " Brings 7+ years of warehouse experience." })).toContain("invented_metric");
  });
  test("contact details copied into prose are still rejected, with actionable feedback", () => {
    const v = validatePackage({ resume: { ...faithful(), location: "Columbus, OH · alex.test@example.com" } }, facts);
    const p = v.find((x) => x.code === "placeholder");
    expect(p?.detail).toContain("example.com");
    expect(p?.detail).toContain("contact details");
  });
  test("invented employer and credential are still rejected", () => {
    const r = faithful();
    r.experience[0]!.company = "Amazon";
    r.education[0]!.credential = "Bachelor of Science";
    expect(codes(r)).toContain("invented_employer");
    expect(codes(r)).toContain("invented_degree");
  });
  test("log categories never carry the matched text", () => {
    expect(placeholderKind("alex.test@example.com")).toBe("example_domain");
    expect(placeholderKind("555-0")).toBe("test_phone");
    expect(placeholderKind("[Your Phone]")).toBe("brackets");
  });
});
