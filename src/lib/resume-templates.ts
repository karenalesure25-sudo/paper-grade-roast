export type ResumeExperience = {
  company: string;
  role: string;
  location: string;
  dates: string;
  bullets: string[];
};

export type ResumeEducation = {
  school: string;
  credential: string;
  dates: string;
};

export type ResumeData = {
  name: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  summary: string;
  objective: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
};

export type TemplateId =
  | "sidebar"
  | "timeline"
  | "classic"
  | "timeline-forest"
  | "timeline-charcoal"
  | "sidebar-teal"
  | "navy-gold";

export type ResumeTemplateMeta = {
  id: TemplateId;
  name: string;
  blurb: string;
  /** Photo templates prompt the buyer for a selfie. */
  usesPhoto: boolean;
};

export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: "sidebar",
    name: "The Red Rule",
    blurb: "Photo up top, red section tabs, dated left rail. Bold and scannable.",
    usesPhoto: true,
  },
  {
    id: "timeline",
    name: "The Two-Column",
    blurb: "Grey sidebar with your photo and contact blocks, timeline on the right.",
    usesPhoto: true,
  },
  {
    id: "classic",
    name: "The Plain Sheet",
    blurb: "No photo, no columns. The safest thing to put through an ATS.",
    usesPhoto: false,
  },
  {
    id: "timeline-forest",
    name: "Timeline Forest & Copper",
    blurb: "Forest green header band, copper accents, competency band, dated timeline.",
    usesPhoto: false,
  },
  {
    id: "timeline-charcoal",
    name: "Timeline Charcoal & Blue",
    blurb: "Same dated timeline layout in charcoal with steel-blue accents.",
    usesPhoto: false,
  },
  {
    id: "sidebar-teal",
    name: "Sidebar Teal",
    blurb: "Full-height teal sidebar for contact, skills and school; white main column.",
    usesPhoto: false,
  },
  {
    id: "navy-gold",
    name: "Navy & Gold",
    blurb: "Centered navy header, gold rules under each heading, two-column competencies.",
    usesPhoto: false,
  },
];

/** Fake résumé used for the locked before-purchase previews. */
export const SAMPLE_RESUME: ResumeData = {
  name: "Jordan A. Rivera",
  title: "Operations Coordinator",
  location: "Chicago, IL",
  email: "jordan.rivera@example.com",
  phone: "(312) 555-0148",
  summary:
    "Operations coordinator with 6 years scheduling, vendor management, and reporting for high-volume service teams. Cut fulfillment errors 18% by rebuilding the intake checklist.",
  objective:
    "Seeking an operations role where process design and reporting directly move on-time delivery.",
  experience: [
    {
      company: "Northline Logistics",
      role: "Operations Coordinator",
      location: "Chicago, IL",
      dates: "03/2022 - Present",
      bullets: [
        "Coordinated 40+ weekly shipments across 3 regional hubs with 99.2% on-time delivery.",
        "Rebuilt the intake checklist, cutting fulfillment errors 18% in two quarters.",
        "Trained 11 new coordinators on dispatch software and escalation policy.",
      ],
    },
    {
      company: "Vaughn Service Group",
      role: "Scheduling Specialist",
      location: "Oak Park, IL",
      dates: "06/2019 - 02/2022",
      bullets: [
        "Managed technician calendars for 220 accounts, reducing same-day cancellations 24%.",
        "Built the weekly capacity report leadership used for hiring decisions.",
      ],
    },
  ],
  education: [
    {
      school: "Harold Washington College",
      credential: "A.A., Business Administration",
      dates: "2019",
    },
  ],
  skills: [
    "Process Documentation",
    "Vendor Management",
    "Excel / Sheets",
    "Dispatch Software",
    "KPI Reporting",
    "Team Training",
    "Scheduling",
    "Escalation Handling",
  ],
};
