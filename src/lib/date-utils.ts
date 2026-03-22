import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';

export function formatHistoryDate(date: Date): string {
  const now = new Date();

  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  
  const daysDiff = differenceInCalendarDays(now, date);

  // e.g. "Thursday 12"
  if (daysDiff < 7) {
    return format(date, 'eeee d');
  }
  
  // e.g. "Saturday 07/03/26" - user said "a week later"
  if (daysDiff < 14) { 
    return format(date, 'eeee d/MM/yy');
  }
  
  // e.g. "28/02/2026" - user said "another week later"
  return format(date, 'dd/MM/yyyy');
}
