/**
 * Format date to ISO string for API
 */
export const formatDateForApi = (date: Date): string => {
  return date.toISOString();
};

/**
 * Format date for display
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format time for display (local timezone — use for real UTC instants like clock-in/out)
 */
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format schedule time for display (reads UTC hours as wall-clock time).
 * Schedule times are stored as UTC where the UTC value IS the intended local time.
 * Use this for ScheduleShift.startDate / endDate.
 */
export const formatScheduleTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
};

/**
 * Format date and time for display
 */
export const formatDateTime = (date: Date | string): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

/**
 * Get start of day
 */
export const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of day
 */
export const getEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Get start of week (Sunday)
 */
export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return getStartOfDay(new Date(d.setDate(diff)));
};

/**
 * Get end of week (Saturday)
 */
export const getEndOfWeek = (date: Date): Date => {
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return getEndOfDay(endOfWeek);
};

/**
 * Get start of month
 */
export const getStartOfMonth = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return getStartOfDay(d);
};

/**
 * Get end of month
 */
export const getEndOfMonth = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return getEndOfDay(d);
};

/**
 * Calculate duration between two dates in hours
 */
export const calculateDuration = (start: Date | string, end: Date | string): number => {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const diff = endDate.getTime() - startDate.getTime();
  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100; // Hours with 2 decimal places
};

/**
 * Format duration in hours to readable string
 */
export const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};
