// Calendar-only values stay in destination-local calendar space, never UTC midnight.
export function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(new Date().setHours(12, 0, 0, 0));
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(2000, month - 1, day, 12);
  date.setFullYear(year);
  return date;
}
export function dateValue(value: Date): string {
  return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
export function timeValue(value: Date): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
export function displayDate(value: string): string {
  if (!value) return "Odaberi datum";
  const [y, m, d] = value.split("-").map(Number);
  return `${d}. ${m}. ${y}.`;
}
export function tripDays(start: string, end: string): string[] {
  const day = calendarDate(start);
  const last = calendarDate(end);
  const result: string[] = [];
  // Keep large trips usable without mounting an unbounded horizontal list.
  while (day <= last && result.length < 366) {
    result.push(dateValue(day));
    day.setDate(day.getDate() + 1);
  }
  return result;
}
