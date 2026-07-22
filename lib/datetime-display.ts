const DISPLAY_LOCALE = "en-US";
const DISPLAY_TIME_ZONE = "UTC";

const TIME_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

export function formatProbeTime(value: string): string {
  return TIME_FORMATTER.format(new Date(value));
}

export function formatProbeDateTime(value: string): string {
  return DATE_TIME_FORMATTER.format(new Date(value));
}
