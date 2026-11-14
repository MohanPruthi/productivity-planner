import { apiGet } from './api';

// Queries more than one component reads, defined once so they share a cache entry

// Meds: the reminder toast (always mounted) and the Meds page
export const medsScheduleQuery = {
  queryKey: ['meds', 'schedule'],
  queryFn: () => apiGet('/api/meds/schedule', 'Failed to load medication details'),
};
export const medsLogsQuery = {
  queryKey: ['meds', 'logs'],
  queryFn: () => apiGet('/api/meds/logs', 'Failed to load medication details'),
};
