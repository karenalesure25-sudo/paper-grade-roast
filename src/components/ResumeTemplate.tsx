import type { ResumeData, TemplateId } from "@/lib/resume-templates";

function PhotoSlot({ photo, className }: { photo: string | null; className?: string }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className={`h-full w-full object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-[#e6e4df] text-center text-[7px] tracking-widest text-[#8b8880] uppercase ${className ?? ""}`}
    >
      Your
      <br />
      photo
    </div>
  );
}

function SidebarTemplate({ data, photo }: { data: ResumeData; photo: string | null }) {
  return (
    <div className="bg-white px-6 py-6 text-[#222] sm:px-8">
      <div className="flex items-start gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-full border-[3px] border-[#d6001c]">
          <PhotoSlot photo={photo} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold tracking-wide text-[#d6001c] uppercase">
            {data.name}
          </h3>
          <div className="mt-1 h-2.5 w-full bg-[#d6001c]" />
          <p className="mt-2 text-[9px] leading-snug">
            {data.location}
            <br />
            {data.email}
            <br />
            {data.phone}
          </p>
        </div>
      </div>

      <p className="mt-5 text-center text-[11px] font-bold tracking-[0.14em] uppercase">
        {data.title}
      </p>

      {[
        { label: "Summary", body: data.summary },
        { label: "Objective", body: data.objective },
      ]
        .filter((block) => Boolean(block.body?.trim()))
        .map((block) => (
        <section key={block.label} className="mt-4">
          <div className="flex items-center">
            <span className="bg-[#d6001c] px-2.5 py-[3px] text-[8px] font-bold tracking-wide text-white uppercase">
              {block.label}
            </span>
            <span className="h-[2px] flex-1 bg-[#d6001c]" />
          </div>
          <p className="mt-2 px-1 text-center text-[9px] leading-relaxed">{block.body}</p>
        </section>
      ))}

      <section className="mt-4">
        <div className="flex items-center">
          <span className="bg-[#d6001c] px-2.5 py-[3px] text-[8px] font-bold tracking-wide text-white uppercase">
            Work Experience
          </span>
          <span className="h-[2px] flex-1 bg-[#d6001c]" />
        </div>
        <div className="mt-3 space-y-4">
          {data.experience.map((job) => (
            <div key={`${job.company}-${job.dates}`} className="flex gap-3">
              <p className="w-20 shrink-0 pt-[2px] text-[8px] leading-snug">{job.dates}</p>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-[#d6001c]">{job.company}</p>
                <p className="text-[9px]">{job.location}</p>
                <p className="text-[9px]">{job.role}</p>
                <ul className="mt-1 space-y-[3px]">
                  {job.bullets.map((bullet) => (
                    <li key={bullet} className="text-[9px] leading-snug">
                      &bull; {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.education.length > 0 && (
      <section className="mt-4">
        <div className="flex items-center">
          <span className="bg-[#d6001c] px-2.5 py-[3px] text-[8px] font-bold tracking-wide text-white uppercase">
            Education
          </span>
          <span className="h-[2px] flex-1 bg-[#d6001c]" />
        </div>
        <div className="mt-2 space-y-2">
          {data.education.map((item) => (
            <div key={item.school} className="flex gap-3">
              <p className="w-20 shrink-0 text-[8px]">{item.dates}</p>
              <p className="text-[9px]">
                {item.school} &mdash; {item.credential}
              </p>
            </div>
          ))}
        </div>
      </section>
      )}

      {data.skills.length > 0 && (
      <section className="mt-4">
        <div className="flex items-center">
          <span className="bg-[#d6001c] px-2.5 py-[3px] text-[8px] font-bold tracking-wide text-white uppercase">
            Skills
          </span>
          <span className="h-[2px] flex-1 bg-[#d6001c]" />
        </div>
        <p className="mt-2 text-[9px] leading-relaxed">{data.skills.join(" \u00b7 ")}</p>
      </section>
      )}

    </div>
  );
}

function TimelineTemplate({ data, photo }: { data: ResumeData; photo: string | null }) {
  return (
    <div className="bg-white text-[#222]">
      <div className="px-6 pt-6 text-center">
        <h3 className="text-[15px] font-bold tracking-wide uppercase">{data.name}</h3>
        <p className="mt-1 text-[10px] font-bold tracking-wide text-[#d6001c] uppercase">
          {data.title}
        </p>
      </div>

      <div className="mt-4 flex gap-5 px-5 pb-6">
        <aside className="w-[34%] shrink-0 bg-[#efefec] p-3">
          <div className="mx-auto aspect-[3/4] w-full overflow-hidden">
            <PhotoSlot photo={photo} />
          </div>
          {[
            { label: "Phone", value: data.phone },
            { label: "E-mail", value: data.email },
            { label: "Address", value: data.location },
          ].map((row) => (
            <div key={row.label} className="mt-2 bg-[#d6001c] px-2 py-1 text-white">
              <p className="text-[7px] font-bold tracking-widest uppercase">{row.label}</p>
              <p className="text-[8px] break-words">{row.value}</p>
            </div>
          ))}
          <h4 className="mt-4 text-[10px] font-bold uppercase">Summary</h4>
          <p className="mt-1 text-[8px] leading-relaxed">{data.summary}</p>
          {data.skills.length > 0 && (
          <>
          <h4 className="mt-4 text-[10px] font-bold uppercase">Skills</h4>
          <ul className="mt-1 space-y-[2px]">
            {data.skills.slice(0, 6).map((skill) => (
              <li key={skill} className="text-[8px]">
                {skill}
              </li>
            ))}
          </ul>
          </>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          {data.objective?.trim() && (
            <>
              <h4 className="text-[11px] font-bold uppercase">Objective</h4>
              <p className="mt-1 text-[9px] leading-relaxed">{data.objective}</p>
            </>
          )}


          <h4 className="mt-4 text-[11px] font-bold uppercase">Work Experience</h4>
          <div className="mt-2 space-y-4">
            {data.experience.map((job) => (
              <div key={`${job.company}-${job.dates}`} className="flex gap-3">
                <div className="w-[76px] shrink-0 text-right">
                  <p className="text-[8px] font-bold text-[#d6001c]">{job.dates}</p>
                  <p className="text-[9px] font-bold">{job.company}</p>
                </div>
                <div className="relative border-l border-[#d6d4cf] pl-3">
                  <span className="absolute top-[3px] -left-[4px] size-[7px] rounded-full border-2 border-[#d6001c] bg-white" />
                  <p className="text-[8px]">{job.location}</p>
                  <p className="text-[9px] font-bold italic text-[#d6001c]">{job.role}</p>
                  <ul className="mt-1 space-y-[3px]">
                    {job.bullets.map((bullet) => (
                      <li key={bullet} className="text-[9px] leading-snug">
                        &bull; {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {data.education.length > 0 && (
          <h4 className="mt-4 text-[11px] font-bold uppercase">Education</h4>
          )}
          <div className="mt-2 space-y-2">
            {data.education.map((item) => (
              <div key={item.school} className="flex gap-3">
                <p className="w-[76px] shrink-0 text-right text-[8px] font-bold text-[#d6001c]">
                  {item.dates}
                </p>
                <p className="text-[9px]">
                  <span className="font-bold">{item.credential}</span>
                  <br />
                  {item.school}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassicTemplate({ data }: { data: ResumeData }) {
  return (
    <div className="bg-white px-7 py-7 text-[#222] sm:px-9">
      <h3 className="text-[15px] font-bold uppercase">{data.name}</h3>
      <p className="text-[11px] font-bold">{data.title}</p>
      <p className="mt-1 text-[9px] leading-snug">
        {data.location}
        <br />
        {data.email}
        <br />
        {data.phone}
      </p>

      {[
        { label: "Summary", body: data.summary },
        { label: "Objective", body: data.objective },
      ]
        .filter((block) => Boolean(block.body?.trim()))
        .map((block) => (
        <section key={block.label} className="mt-4">
          <h4 className="border-b-2 border-[#222] pb-1 text-[11px] font-bold">
            {block.label}
          </h4>
          <p className="mt-2 text-[9px] leading-relaxed">{block.body}</p>
        </section>
      ))}

      <section className="mt-4">
        <h4 className="border-b-2 border-[#222] pb-1 text-[11px] font-bold">
          Work Experience
        </h4>
        <div className="mt-2 space-y-3">
          {data.experience.map((job) => (
            <div key={`${job.company}-${job.dates}`}>
              <p className="text-[9px]">
                <span className="font-bold">{job.company}</span> &mdash; ({job.dates})
              </p>
              <p className="text-[9px]">{job.location}</p>
              <p className="text-[9px]">{job.role}</p>
              <ul className="mt-1 space-y-[3px]">
                {job.bullets.map((bullet) => (
                  <li key={bullet} className="text-[9px] leading-snug">
                    &bull; {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {data.education.length > 0 && (
      <section className="mt-4">
        <h4 className="border-b-2 border-[#222] pb-1 text-[11px] font-bold">Education</h4>
        <div className="mt-2 space-y-1">
          {data.education.map((item) => (
            <p key={item.school} className="text-[9px]">
              <span className="font-bold">{item.credential}</span>, {item.school} (
              {item.dates})
            </p>
          ))}
        </div>
      </section>
      )}

      {data.skills.length > 0 && (
      <section className="mt-4">
        <h4 className="border-b-2 border-[#222] pb-1 text-[11px] font-bold">Skills</h4>
        <p className="mt-2 text-[9px] leading-relaxed">{data.skills.join(" \u2022 ")}</p>
      </section>
      )}
    </div>
  );
}

type BandTheme = {
  band: string;
  accent: string;
  accentSoft: string;
};

const FOREST_THEME: BandTheme = {
  band: "#183d35",
  accent: "#b96f3e",
  accentSoft: "#f2e3d8",
};

const CHARCOAL_THEME: BandTheme = {
  band: "#242424",
  accent: "#4d7fa8",
  accentSoft: "#e4eef6",
};

function BandTimelineTemplate({
  data,
  theme,
}: {
  data: ResumeData;
  theme: BandTheme;
}) {
  return (
    <div className="min-h-[560px] bg-white px-5 py-5 text-[#222]">
      <div className="px-5 py-5" style={{ backgroundColor: theme.band }}>
        <h3 className="text-[17px] font-bold tracking-wide text-white uppercase">
          {data.name}
        </h3>
        <p
          className="mt-1 text-[10px] font-bold tracking-[0.08em] uppercase"
          style={{ color: theme.accent }}
        >
          {data.title}
        </p>
        <p className="mt-1 text-[9px] text-white/80">
          {[data.location, data.phone, data.email].filter(Boolean).join("  |  ")}
        </p>
      </div>

      {[
        { label: "Professional Summary", body: data.summary },
        { label: "Objective", body: data.objective },
      ]
        .filter((block) => Boolean(block.body?.trim()))
        .map((block) => (
          <section key={block.label} className="mt-4 px-1">
            <div className="flex items-center gap-2">
              <span
                className="h-[14px] w-[4px]"
                style={{ backgroundColor: theme.accent }}
              />
              <h4 className="text-[11px] font-bold tracking-wide uppercase">
                {block.label}
              </h4>
            </div>
            <p className="mt-1 text-[9px] leading-relaxed">{block.body}</p>
          </section>
        ))}

      {data.skills.length > 0 && (
        <>
          <section className="mt-4 px-1">
            <div className="flex items-center gap-2">
              <span
                className="h-[14px] w-[4px]"
                style={{ backgroundColor: theme.accent }}
              />
              <h4 className="text-[11px] font-bold tracking-wide uppercase">
                Core Competencies
              </h4>
            </div>
          </section>
          <p
            className="mt-2 px-4 py-3 text-center text-[8px] text-white"
            style={{ backgroundColor: theme.band }}
          >
            {data.skills.join("  \u2022  ")}
          </p>
        </>
      )}

      <section className="mt-4 px-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="h-[14px] w-[4px]" style={{ backgroundColor: theme.accent }} />
          <h4 className="text-[11px] font-bold tracking-wide uppercase">
            Professional Experience
          </h4>
        </div>
        <div className="mt-3 space-y-3">
          {data.experience.map((job) => (
            <div
              key={`${job.company}-${job.dates}`}
              className="flex gap-3"
            >
              <div
                className="w-[86px] shrink-0 p-2.5"
                style={{ backgroundColor: theme.accentSoft }}
              >
                <p className="text-[8px] font-bold" style={{ color: theme.accent }}>
                  {job.dates}
                </p>
                <p className="mt-1 text-[8px] leading-snug">{job.location}</p>
              </div>
              <div className="min-w-0 flex-1 p-2">
                <p className="text-[10px] font-bold">{job.role}</p>
                <p className="text-[9px] font-bold" style={{ color: theme.accent }}>
                  {job.company}
                </p>
                <ul className="mt-1 space-y-[3px]">
                  {job.bullets.map((bullet) => (
                    <li key={bullet} className="text-[9px] leading-snug">
                      &bull; {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {data.education.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span
                className="h-[14px] w-[4px]"
                style={{ backgroundColor: theme.accent }}
              />
              <h4 className="text-[11px] font-bold tracking-wide uppercase">Education</h4>
            </div>
            <div className="mt-2 space-y-1">
              {data.education.map((item) => (
                <p key={item.school} className="text-[9px]">
                  <span className="font-bold">{item.credential}</span>, {item.school} (
                  {item.dates})
                </p>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SidebarTealTemplate({ data }: { data: ResumeData }) {
  const teal = "#115e5c";
  return (
    <div className="flex min-h-[520px] bg-white text-[#222]">
      <aside className="w-[34%] shrink-0 px-4 py-6 text-white" style={{ backgroundColor: teal }}>
        <h3 className="text-[15px] font-bold">{data.name}</h3>
        <p className="mt-1 text-[8px] tracking-wide text-white/80 uppercase">
          {data.title}
        </p>

        <h4 className="mt-5 text-[10px] font-bold tracking-wide uppercase">Contact</h4>
        <ul className="mt-1 space-y-[2px]">
          {[data.location, data.phone, data.email].filter(Boolean).map((line) => (
            <li key={line} className="text-[8px] break-words text-white/90">
              &bull; {line}
            </li>
          ))}
        </ul>

        {data.skills.length > 0 && (
          <>
            <h4 className="mt-5 text-[10px] font-bold tracking-wide uppercase">
              Competencies
            </h4>
            <ul className="mt-1 space-y-[2px]">
              {data.skills.map((skill) => (
                <li key={skill} className="text-[8px] text-white/90">
                  &bull; {skill}
                </li>
              ))}
            </ul>
          </>
        )}

        {data.education.length > 0 && (
          <>
            <h4 className="mt-5 text-[10px] font-bold tracking-wide uppercase">
              Education
            </h4>
            <div className="mt-1 space-y-2">
              {data.education.map((item) => (
                <p key={item.school} className="text-[8px] text-white/90">
                  <span className="font-bold text-white">{item.credential}</span>
                  <br />
                  {item.school} ({item.dates})
                </p>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="min-w-0 flex-1 px-6 py-6">
        {[
          { label: "Summary", body: data.summary },
          { label: "Objective", body: data.objective },
        ]
          .filter((block) => Boolean(block.body?.trim()))
          .map((block) => (
            <section key={block.label} className="mb-4">
              <h4
                className="border-b pb-[3px] text-[11px] font-bold uppercase"
                style={{ color: teal, borderColor: teal }}
              >
                {block.label}
              </h4>
              <p className="mt-2 text-[9px] leading-relaxed">{block.body}</p>
            </section>
          ))}

        <section>
          <h4
            className="border-b pb-[3px] text-[11px] font-bold uppercase"
            style={{ color: teal, borderColor: teal }}
          >
            Experience
          </h4>
          <div className="mt-2 space-y-3">
            {data.experience.map((job) => (
              <div key={`${job.company}-${job.dates}`}>
                <p className="text-[9px] font-bold uppercase" style={{ color: teal }}>
                  {job.company} &mdash; {job.location}
                </p>
                <p className="text-[9px] font-bold italic">
                  {job.role} ({job.dates})
                </p>
                <ul className="mt-1 space-y-[3px]">
                  {job.bullets.map((bullet) => (
                    <li key={bullet} className="text-[9px] leading-snug">
                      &bull; {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function NavyGoldTemplate({ data }: { data: ResumeData }) {
  const navy = "#1d2b50";
  const gold = "#b8912f";
  const heading = (label: string) => (
    <h4
      className="border-b-2 pb-[3px] text-[11px] font-bold uppercase"
      style={{ color: navy, borderColor: gold }}
    >
      {label}
    </h4>
  );

  return (
    <div className="bg-white text-[#222]">
      <div className="px-6 py-6 text-center" style={{ backgroundColor: navy }}>
        <h3 className="text-[18px] font-bold tracking-wide text-white uppercase">
          {data.name}
        </h3>
        <p
          className="mt-1 text-[10px] font-bold tracking-[0.08em] uppercase"
          style={{ color: gold }}
        >
          {data.title}
        </p>
        <p className="mt-1 text-[9px] text-white/85">
          {[data.location, data.phone, data.email].filter(Boolean).join("  |  ")}
        </p>
      </div>

      <div className="px-7 py-6">
        {[
          { label: "Summary", body: data.summary },
          { label: "Objective", body: data.objective },
        ]
          .filter((block) => Boolean(block.body?.trim()))
          .map((block) => (
            <section key={block.label} className="mb-4">
              {heading(block.label)}
              <p className="mt-2 text-[9px] leading-relaxed">{block.body}</p>
            </section>
          ))}

        {data.skills.length > 0 && (
          <section className="mb-4">
            {heading("Competencies")}
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-[3px]">
              {data.skills.map((skill) => (
                <li key={skill} className="text-[9px]">
                  &bull; {skill}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-4">
          {heading("Experience")}
          <div className="mt-2 space-y-3">
            {data.experience.map((job) => (
              <div key={`${job.company}-${job.dates}`}>
                <p className="text-[9px] font-bold uppercase" style={{ color: navy }}>
                  {job.company} &mdash; {job.location}
                </p>
                <p className="text-[9px] font-bold italic">
                  {job.role} ({job.dates})
                </p>
                <ul className="mt-1 space-y-[3px]">
                  {job.bullets.map((bullet) => (
                    <li key={bullet} className="text-[9px] leading-snug">
                      &bull; {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {data.education.length > 0 && (
          <section>
            {heading("Education")}
            <div className="mt-2 space-y-1">
              {data.education.map((item) => (
                <p key={item.school} className="text-[9px]">
                  <span className="font-bold">{item.credential}</span>, {item.school} (
                  {item.dates})
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Renders résumé data in one of the buyer-selectable layouts. */
export function ResumeTemplate({
  template,
  data,
  photo = null,
}: {
  template: TemplateId;
  data: ResumeData;
  photo?: string | null;
}) {
  if (template === "sidebar") return <SidebarTemplate data={data} photo={photo} />;
  if (template === "timeline") return <TimelineTemplate data={data} photo={photo} />;
  if (template === "timeline-forest")
    return <BandTimelineTemplate data={data} theme={FOREST_THEME} />;
  if (template === "timeline-charcoal")
    return <BandTimelineTemplate data={data} theme={CHARCOAL_THEME} />;
  if (template === "sidebar-teal") return <SidebarTealTemplate data={data} />;
  if (template === "navy-gold") return <NavyGoldTemplate data={data} />;
  return <ClassicTemplate data={data} />;
}
