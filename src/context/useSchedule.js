import { useContext } from 'react';
import { ScheduleContext } from './scheduleContextValue';

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useSchedule must be used within a ScheduleProvider');
  return context;
}
