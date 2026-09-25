export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function formatTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date());
  const abbreviation = parts.find(
    (part) => part.type === "timeZoneName",
  )?.value;
  return abbreviation ? `${timeZone} (${abbreviation})` : timeZone;
}

export function formatLocalDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}

export function formatLocalDate(
  value: string | Date,
  timeZone: string,
  full = false,
) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: full ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function localDateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
