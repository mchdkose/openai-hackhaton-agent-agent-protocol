export const DEMO_CLOCK_ISO = process.env.DEMO_CLOCK_ISO || '2026-10-12T17:00:00+03:00';
export function scenarioNow(): Date { return new Date(DEMO_CLOCK_ISO); }
export function localMinutes(date: Date, timezone = 'Europe/Istanbul'): number {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(date);
  return Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
}
export function timeMinutes(time: string): number { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; }
