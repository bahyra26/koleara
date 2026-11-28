const wibDateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const wibTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const wibShortDateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatIdr(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

export function formatWibDateTime(timestampMs: number): string {
  return `${wibDateTimeFormatter.format(new Date(timestampMs))} WIB`;
}

export function formatWibShortDate(timestampMs: number): string {
  return `${wibShortDateFormatter.format(new Date(timestampMs))} WIB`;
}

export function formatWibTime(timestampMs: number): string {
  return `${wibTimeFormatter.format(new Date(timestampMs))} WIB`;
}

export function formatWibClockTime(timestampMs: number): string {
  return wibTimeFormatter.format(new Date(timestampMs)).replace(".", ":");
}

const SLOT_DOW_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const WIB_OFFSET_MS = 7 * 3_600_000;

/**
 * Resolves a weekly slot label such as "Mon 18:30" into the next upcoming UTC timestamp (ms) in WIB.
 */
export function resolveNextSlotTimestampWib(
  slotLabel: string,
  nowMs = Date.now()
): number | null {
  const match = slotLabel
    .trim()
    .match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2}):(\d{2})$/i);
  if (!match) return null;

  const targetDow = SLOT_DOW_INDEX[match[1].toLowerCase()];
  const hour = Number.parseInt(match[2], 10);
  const minute = Number.parseInt(match[3], 10);
  if (
    targetDow === undefined ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const wibNow = new Date(nowMs + WIB_OFFSET_MS);
  const daysAhead = (targetDow - wibNow.getUTCDay() + 7) % 7;
  let candidateMs =
    Date.UTC(
      wibNow.getUTCFullYear(),
      wibNow.getUTCMonth(),
      wibNow.getUTCDate() + daysAhead,
      hour,
      minute,
      0,
      0
    ) - WIB_OFFSET_MS;

  if (candidateMs <= nowMs + 60_000) {
    candidateMs += 7 * 86_400_000;
  }
  return candidateMs;
}

/**
 * Parses an HTML datetime-local string ("YYYY-MM-DDTHH:mm") explicitly as WIB (UTC+07:00).
 */
export function parseWibDateTimeLocal(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }
  const timestamp = Date.parse(`${trimmed}:00+07:00`);
  if (Number.isNaN(timestamp)) return null;
  return toWibDateTimeLocalValue(timestamp) === trimmed ? timestamp : null;
}

/**
 * Converts a timestamp (ms) into a "YYYY-MM-DDTHH:mm" value expressed in Asia/Jakarta (WIB).
 */
export function toWibDateTimeLocalValue(timestampMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestampMs));

  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

export function getInitials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}
