/**
 * Service-window arithmetic in America/Chicago (DST-aware). Stored values stay UTC.
 * Sunday hours (local Chicago Sunday, 00:00–24:00) never count toward a window.
 */
export const SERVICE_TZ = "America/Chicago";
export const DELIVERY_WINDOW_HOURS = { min: 24, max: 48 } as const;
export const MINOR_REVISION_DAYS = 7;

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: SERVICE_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
});

function local(t: number) {
  const p = Object.fromEntries(parts.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { y: +p["year"]!, m: +p["month"]!, d: +p["day"]!, h: +p["hour"]!, mi: +p["minute"]!, s: +p["second"]!, wd: p["weekday"]! };
}

/** Offset (ms) of Chicago from UTC at instant t. */
function offsetAt(t: number): number {
  const l = local(t);
  return Date.UTC(l.y, l.m - 1, l.d, l.h, l.mi, l.s) - Math.floor(t / 1000) * 1000;
}

/** UTC instant of local Chicago midnight starting the given local calendar date (normalizes overflow). */
export function chicagoMidnight(y: number, m: number, d: number): number {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t); // re-evaluate on the correct side of a DST change
  return t;
}

export function isChicagoSunday(t: number): boolean {
  return local(t).wd === "Sun";
}

/** Adds `hours` of eligible time to `start`, skipping every local Sunday hour. */
export function addEligibleHours(start: Date | string, hours: number): Date {
  let t = new Date(start).getTime();
  let remaining = hours * 3600_000;
  for (let guard = 0; guard < 64 && remaining > 0; guard++) {
    const l = local(t);
    const nextMidnight = chicagoMidnight(l.y, l.m, l.d + 1);
    if (l.wd === "Sun") { t = nextMidnight; continue; }
    const span = nextMidnight - t;
    if (remaining <= span) { t += remaining; remaining = 0; } else { remaining -= span; t = nextMidnight; }
  }
  return new Date(t);
}

/** Initial-delivery window, measured from payment or the latest required clarification, whichever is later. */
export function deliveryWindow(start: Date | string) {
  return { earliest: addEligibleHours(start, DELIVERY_WINDOW_HOURS.min), latest: addEligibleHours(start, DELIVERY_WINDOW_HOURS.max) };
}

/**
 * The included minor revision may be requested until the end of the 7th Central calendar day
 * after files were first available. Mirrors SQL public.minor_revision_window_end.
 */
export function minorRevisionWindowEnd(deliveredAt: Date | string): Date {
  const l = local(new Date(deliveredAt).getTime());
  return new Date(chicagoMidnight(l.y, l.m, l.d + MINOR_REVISION_DAYS + 1));
}

export function minorRevisionOpen(deliveredAt: Date | string | null | undefined, now = new Date()): boolean {
  return Boolean(deliveredAt) && now.getTime() < minorRevisionWindowEnd(deliveredAt!).getTime();
}
