const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

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
  return idrFormatter.format(Math.round(amount));
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
