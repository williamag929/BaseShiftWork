# Schedule Grid Component

A custom calendar/grid view for scheduling that mimics professional workforce management interfaces.

## Features

- **Week View Layout**: 7-day horizontal scrollable grid with employee rows
- **Employee Roster**: Left column showing team members with initials, names, and weekly hours
- **Shift Blocks**: Color-coded shift cards showing time ranges and assigned person
- **Status Indicators**: Visual badges for locked, published, unpublished, and open shifts
- **Filtering**: Search bar and filter modal for shift types, training requirements, and sorting
- **Statistics Bar**: Real-time counts for empty slots, unpublished shifts, warnings, etc.
- **Unavailable Indicators**: Purple badges showing unavailable team members per day
- **Add Shift**: Tap empty cells to create new shifts
- **Responsive**: Horizontal and vertical scrolling for large rosters

## Usage

The component is available in two places:

1. **Standalone Component**: `components/ScheduleGrid.tsx`
   - Reusable component accepting data props
   - Can be embedded in any screen

2. **Tab Screen**: `app/(tabs)/schedule-grid.tsx`
   - Full-featured screen with data fetching
   - Accessible via "Grid" tab in bottom navigation

## Data Flow

```
useScheduleGrid hook
  ↓
  Fetches schedules & shifts for week
  ↓
  Transforms to ScheduleGridData
  ↓
  ScheduleGrid component renders
```

## Types

See `types/schedule-grid.ts` for:
- `ScheduleGridData`: Main data structure
- `TeamMember`: Employee info with hours
- `ShiftBlock`: Individual shift details
- `DaySchedule`: Per-day shifts and unavailable count
- `ScheduleFilters`: Search and filter state

## Customization

### Colors
Shift status colors defined in `getShiftColor()`:
- Published: Light green (#C8E6C9)
- Locked: Light green with lock badge
- Unpublished: Light yellow (#FFF9C4)
- Open: Light purple (#E1BEE7)

### Layout
- Team column width: 200px
- Day cell width: 150px
- Minimum row height: 80px

### Integration with Backend

Currently uses:
- `scheduleService.searchSchedules()` - fetch schedules for date range
- `scheduleService.getScheduleShifts()` - fetch all shifts for company

TODO:
- Fetch complete team roster (not just people with shifts)
- Fetch unavailable/time-off data
- Fetch location and area names for display
- Real-time updates via WebSocket or polling

## Example

```tsx
import { useScheduleGrid } from '@/hooks/useScheduleGrid';
import ScheduleGrid from '@/components/ScheduleGrid';

function MyScreen() {
  const { data, filters, setFilters } = useScheduleGrid({
    companyId: '123',
    locationId: 456,
  });

  return (
    <ScheduleGrid
      data={data}
      filters={filters}
      onFiltersChange={setFilters}
      onShiftPress={(shift) => console.log(shift)}
      onAddShift={(personId, date) => console.log('Add', personId, date)}
    />
  );
}
```

## Future Enhancements

- Drag & drop to reassign shifts
- Multi-select for bulk operations
- Export to PDF/Excel
- Print-optimized layout
- Timezone handling for multi-location companies
- Conflict detection (overlapping shifts, double-booking)
- Cost calculation per shift/day/week
- Mobile-optimized touch gestures (pinch-zoom, swipe navigation)
