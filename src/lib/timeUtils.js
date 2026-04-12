import { format, startOfWeek, endOfWeek, addDays, differenceInMinutes, parseISO, isWithinInterval, isBefore, isAfter } from 'date-fns';

export function formatHours(hours) {
  if (!hours && hours !== 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function getWeekRange(date) {
  // Sunday-Saturday workweek
  const start = startOfWeek(date, { weekStartsOn: 0 });
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return { start, end };
}

export function generatePayPeriodDates(startDate) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = addDays(start, 13);
  return {
    start,
    end,
    week1Start: start,
    week1End: addDays(start, 6),
    week2Start: addDays(start, 7),
    week2End: end,
    label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  };
}

export function calculateOvertimeForWeek(entries) {
  const totalHours = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
  const regular = Math.min(40, totalHours);
  const overtime = Math.max(0, totalHours - 40);
  return { totalHours, regular, overtime };
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatTime(dateStr) {
  if (!dateStr) return '—';
  return format(parseISO(dateStr), 'h:mm a');
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return format(parseISO(dateStr), 'MMM d, h:mm a');
}