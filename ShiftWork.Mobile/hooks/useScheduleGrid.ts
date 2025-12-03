import { useState, useEffect, useMemo } from 'react';
import { scheduleService } from '@/services';
import type { ScheduleGridData, ScheduleFilters, TeamMember, ShiftBlock, DaySchedule } from '@/types/schedule-grid';
import type { PersonDto, ScheduleShiftDto } from '@/types/api';
import { formatTime, getStartOfWeek, getEndOfWeek } from '@/utils/date.utils';

interface UseScheduleGridOptions {
  companyId: string;
  locationId?: number;
  weekStart?: Date;
}

export function useScheduleGrid({ companyId, locationId, weekStart }: UseScheduleGridOptions) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<PersonDto[]>([]);
  const [shifts, setShifts] = useState<ScheduleShiftDto[]>([]);
  const [filters, setFilters] = useState<ScheduleFilters>({});

  const currentWeekStart = weekStart || getStartOfWeek(new Date());
  const currentWeekEnd = getEndOfWeek(currentWeekStart);

  useEffect(() => {
    loadScheduleData();
  }, [companyId, locationId, currentWeekStart]);

  const loadScheduleData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all shifts for company (treat 404 as empty) and filter by date range
      const allShifts = await scheduleService.getScheduleShifts(companyId);
      const weekShifts = allShifts.filter((s) => {
        const start = new Date(s.startDate);
        return start >= currentWeekStart && start <= currentWeekEnd;
      });

      setShifts(weekShifts);

      // TODO: Fetch people/team members - for now, derive from shifts
      // In production, you'd call a people service to get full team roster
      const uniquePeople = Array.from(
        new Map(
          weekShifts.map((s) => [
            s.personId,
            {
              personId: s.personId,
              companyId: s.companyId,
              name: `Person ${s.personId}`,
              email: `person${s.personId}@example.com`,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as PersonDto,
          ])
        ).values()
      );

      setPeople(uniquePeople);
    } catch (e: any) {
      // Normalize 404 to empty state instead of noisy error
      if (e?.statusCode === 404) {
        setShifts([]);
        setPeople([]);
        setError(null);
      } else {
        setError(e?.message || 'Failed to load schedule data');
      }
    } finally {
      setLoading(false);
    }
  };

  const gridData: ScheduleGridData = useMemo(() => {
    // Build 7 days for the week
    const days: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      const dayShifts = shifts.filter((s) => {
        const shiftDate = new Date(s.startDate);
        return shiftDate.toDateString() === date.toDateString();
      });

      const shiftBlocks: ShiftBlock[] = dayShifts.map((s) => ({
        scheduleShiftId: s.scheduleShiftId,
        personId: s.personId,
        personName: `Person ${s.personId}`, // TODO: lookup real name
        startTime: formatTime(s.startDate),
        endTime: formatTime(s.endDate),
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        locationName: undefined, // TODO: lookup
        areaName: undefined, // TODO: lookup
        status: s.status === 'Published' ? 'published' : 'unpublished',
        isLocked: s.status === 'Locked',
      }));

      days.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        unavailableCount: 0, // TODO: fetch unavailable people count
        shifts: shiftBlocks,
      });
    }

    // Build team members with hours
    const teamMembers: TeamMember[] = people.map((p) => {
      const personShifts = shifts.filter((s) => s.personId === p.personId);
      const totalMinutes = personShifts.reduce((sum, s) => {
        const start = new Date(s.startDate).getTime();
        const end = new Date(s.endDate).getTime();
        return sum + (end - start) / (1000 * 60);
      }, 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.floor(totalMinutes % 60);

      return {
        personId: p.personId,
        initials: p.name ? p.name.split(' ').map(n => n.charAt(0)).slice(0, 2).join('') : '',
        fullName: p.name || `Person ${p.personId}`,
        totalHours: `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`,
        profilePhotoUrl: undefined,
      };
    });

    // Calculate stats
    const totalCells = days.length * teamMembers.length;
    const filledCells = shifts.length;
    const published = shifts.filter((s) => s.status === 'Published').length;
    const unpublished = shifts.filter((s) => s.status !== 'Published').length;

    return {
      weekStart: currentWeekStart,
      weekEnd: currentWeekEnd,
      locationName: locationId ? `Location ${locationId}` : '25 Stewart Ave', // TODO: lookup real location
      teamMembers,
      days,
      stats: {
        empty: totalCells - filledCells,
        unpublished,
        published,
        requireConfirmation: 0,
        openShifts: 0,
        warnings: 0,
        leaveApproved: 0,
        leavePending: 0,
        unavailable: 0,
      },
    };
  }, [shifts, people, currentWeekStart, currentWeekEnd, locationId]);

  // Apply filters
  const filteredData: ScheduleGridData = useMemo(() => {
    if (!filters.searchQuery && !filters.shiftTypes?.length && !filters.trainingTypes?.length) {
      return gridData;
    }

    let filteredMembers = [...gridData.teamMembers];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredMembers = filteredMembers.filter((m) =>
        m.fullName.toLowerCase().includes(query)
      );
    }

    // TODO: Apply shift type and training filters

    return {
      ...gridData,
      teamMembers: filteredMembers,
    };
  }, [gridData, filters]);

  return {
    loading,
    error,
    data: filteredData,
    filters,
    setFilters,
    refresh: loadScheduleData,
  };
}
