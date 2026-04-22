import { Component, OnDestroy, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PeopleService } from 'src/app/core/services/people.service';
import { LocationService } from 'src/app/core/services/location.service';
import { ShiftEventService } from 'src/app/core/services/shift-event.service';
import { Location } from 'src/app/core/models/location.model';
import { People } from 'src/app/core/models/people.model';
import { ShiftEvent } from 'src/app/core/models/shift-event.model';
import { Subscription, forkJoin, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface KpiMetric {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  description: string;
}

interface LocationHealth {
  name: string;
  onShift: number;
  late: number;
  gpsCompliance: number;
  geofenceBreaches: number;
}

interface OpsNotification {
  title: string;
  description: string;
  level: 'critical' | 'warning' | 'info';
  ago: string;
  icon: string;
}

interface HourlyPoint {
  hour: string;
  count: number;
}

interface UpcomingFeature {
  title: string;
  summary: string;
  impact: string;
  icon: string;
  eta: string;
}

@Component({
  selector: 'app-dashboard-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.css'],
  standalone: false
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  now: Date = new Date();
  activeRange: '24h' | '7d' | '30d' = '24h';
  activeCompanyName = 'Your Company';
  activeCompanyId: string | null = null;
  loading = false;

  kpis: KpiMetric[] = [
    {
      label: 'Active Staff',
      value: '0',
      trend: '0%',
      trendUp: true,
      icon: 'badge',
      description: 'currently on shift'
    },
    {
      label: 'Clock Events Today',
      value: '0',
      trend: '0',
      trendUp: true,
      icon: 'event_available',
      description: 'all check-ins and check-outs'
    },
    {
      label: 'GPS Compliance',
      value: '0%',
      trend: '0%',
      trendUp: true,
      icon: 'my_location',
      description: 'clock-ins inside geofence'
    },
    {
      label: 'Overtime Risk',
      value: '0 people',
      trend: '0 alerts',
      trendUp: true,
      icon: 'warning_amber',
      description: 'approaching legal limit'
    }
  ];

  hourlyActivity: HourlyPoint[] = [
    { hour: '06:00', count: 5 },
    { hour: '08:00', count: 18 },
    { hour: '10:00', count: 29 },
    { hour: '12:00', count: 24 },
    { hour: '14:00', count: 31 },
    { hour: '16:00', count: 27 },
    { hour: '18:00', count: 19 },
    { hour: '20:00', count: 11 }
  ];

  locations: LocationHealth[] = [
    {
      name: 'North Warehouse',
      onShift: 24,
      late: 2,
      gpsCompliance: 98,
      geofenceBreaches: 1
    },
    {
      name: 'Downtown Retail',
      onShift: 18,
      late: 4,
      gpsCompliance: 93,
      geofenceBreaches: 3
    },
    {
      name: 'Airport Logistics',
      onShift: 40,
      late: 1,
      gpsCompliance: 97,
      geofenceBreaches: 0
    }
  ];

  notifications: OpsNotification[] = [
    {
      title: 'Potential Buddy Punch',
      description: '2 check-ins flagged for biometric mismatch at Downtown Retail.',
      level: 'critical',
      ago: '5 min ago',
      icon: 'gpp_maybe'
    },
    {
      title: 'Geofence Drift Spike',
      description: 'North Warehouse has 3x normal drift events in the past hour.',
      level: 'warning',
      ago: '11 min ago',
      icon: 'location_searching'
    },
    {
      title: 'Schedule Optimization Available',
      description: 'AI suggests reducing overtime by 7.4 hours this week.',
      level: 'info',
      ago: '28 min ago',
      icon: 'lightbulb'
    }
  ];

  readonly upcomingFeatures: UpcomingFeature[] = [
    {
      title: 'Historical Trend Engine',
      summary: 'Compare key metrics across 24h, 7d, and 30d using real baseline periods.',
      impact: 'Improves staffing decisions and forecast confidence.',
      icon: 'query_stats',
      eta: 'vNext +1'
    },
    {
      title: 'Live GPS Heat Map',
      summary: 'Show geofenced check-ins on a map with drift and hotspot overlays per location.',
      impact: 'Accelerates fraud detection and location policy enforcement.',
      icon: 'map',
      eta: 'vNext +2'
    },
    {
      title: 'Role-Based Dashboard Views',
      summary: 'Tailor widgets and notifications for admin, manager, and supervisor personas.',
      impact: 'Reduces noise and increases action rate for each role.',
      icon: 'admin_panel_settings',
      eta: 'vNext +3'
    },
    {
      title: 'Predictive Attendance Alerts',
      summary: 'Flag late-arrival and overtime risks before shift start using historical behavior.',
      impact: 'Prevents coverage gaps before they affect operations.',
      icon: 'notification_important',
      eta: 'vNext +3'
    }
  ];

  private clockSub: Subscription = Subscription.EMPTY;
  private dataSub: Subscription = Subscription.EMPTY;

  constructor(
    private store: Store<AppState>,
    private peopleService: PeopleService,
    private locationService: LocationService,
    private shiftEventService: ShiftEventService
  ) {}

  ngOnInit(): void {
    this.dataSub = this.store.select(selectActiveCompany).subscribe((company: any) => {
      if (!company?.companyId) {
        return;
      }

      this.activeCompanyId = company.companyId;
      this.activeCompanyName = company.name || 'Your Company';
      this.reloadDashboard(company.companyId);
    });

    this.clockSub = interval(60000).subscribe(() => {
      this.now = new Date();
    });
  }

  ngOnDestroy(): void {
    this.clockSub.unsubscribe();
    this.dataSub.unsubscribe();
  }

  setRange(range: '24h' | '7d' | '30d'): void {
    this.activeRange = range;
  }

  reloadDashboard(companyId: string): void {
    this.loading = true;

    forkJoin({
      people: this.peopleService.getPeople(companyId, 1, 500).pipe(catchError(() => of([] as People[]))),
      locations: this.locationService.getLocations(companyId).pipe(catchError(() => of([] as Location[]))),
      events: this.shiftEventService.getShiftEvents(companyId).pipe(catchError(() => of([] as ShiftEvent[])))
    }).subscribe(({ people, locations, events }) => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEvents = events.filter(evt => {
        const date = new Date(evt.eventDate);
        return !isNaN(date.getTime()) && date >= dayStart;
      });

      const clockEvents = todayEvents.filter(evt => {
        const type = (evt.eventType || '').toLowerCase();
        return type === 'clockin' || type === 'clockout';
      });

      const activeStaffCount = people.filter(person => {
        const state = (person.statusShiftWork || person.status || '').toLowerCase();
        return state === 'onshift';
      }).length;

      const eventsWithGps = clockEvents.filter(evt => !!(evt.geoLocation && evt.geoLocation.trim())).length;
      const gpsCompliance = clockEvents.length ? Math.round((eventsWithGps / clockEvents.length) * 1000) / 10 : 100;

      const eventsPerPerson = new Map<number, number>();
      for (const evt of clockEvents) {
        eventsPerPerson.set(evt.personId, (eventsPerPerson.get(evt.personId) || 0) + 1);
      }
      const overtimeRiskCount = Array.from(eventsPerPerson.values()).filter(count => count >= 4).length;

      this.kpis = [
        {
          label: 'Active Staff',
          value: `${activeStaffCount}`,
          trend: `${people.length ? Math.round((activeStaffCount / people.length) * 100) : 0}% on shift`,
          trendUp: true,
          icon: 'badge',
          description: 'currently on shift'
        },
        {
          label: 'Clock Events Today',
          value: `${clockEvents.length}`,
          trend: `${todayEvents.length} total events`,
          trendUp: true,
          icon: 'event_available',
          description: 'all check-ins and check-outs'
        },
        {
          label: 'GPS Compliance',
          value: `${gpsCompliance}%`,
          trend: `${eventsWithGps}/${clockEvents.length || 0} with geolocation`,
          trendUp: gpsCompliance >= 95,
          icon: 'my_location',
          description: 'clock-ins inside geofence'
        },
        {
          label: 'Overtime Risk',
          value: `${overtimeRiskCount} people`,
          trend: `${overtimeRiskCount === 0 ? 'no immediate alerts' : `${overtimeRiskCount} alerts`}`,
          trendUp: overtimeRiskCount === 0,
          icon: 'warning_amber',
          description: 'high event volume indicates possible overtime'
        }
      ];

      this.hourlyActivity = this.buildHourlyActivity(clockEvents);
      this.locations = this.buildLocationHealth(locations, todayEvents);
      this.notifications = this.buildNotifications(gpsCompliance, overtimeRiskCount, clockEvents.length);

      this.loading = false;
    });
  }

  refreshCurrentData(): void {
    if (!this.activeCompanyId) {
      return;
    }

    this.reloadDashboard(this.activeCompanyId);
  }

  get maxActivityCount(): number {
    return Math.max(1, ...this.hourlyActivity.map(point => point.count));
  }

  getActivityHeight(point: HourlyPoint): number {
    const normalized = point.count / this.maxActivityCount;
    return Math.max(14, Math.round(normalized * 100));
  }

  private buildHourlyActivity(events: ShiftEvent[]): HourlyPoint[] {
    const buckets = [6, 8, 10, 12, 14, 16, 18, 20];

    return buckets.map(startHour => {
      const count = events.filter(evt => {
        const date = new Date(evt.eventDate);
        if (isNaN(date.getTime())) {
          return false;
        }
        const hour = date.getHours();
        return hour >= startHour && hour < startHour + 2;
      }).length;

      return {
        hour: `${String(startHour).padStart(2, '0')}:00`,
        count
      };
    });
  }

  private buildLocationHealth(locations: Location[], events: ShiftEvent[]): LocationHealth[] {
    const defaultLocations = this.locations;
    const sourceLocations = locations.length ? locations.slice(0, 3) : [];

    if (!sourceLocations.length) {
      return defaultLocations;
    }

    return sourceLocations.map((loc, index) => {
      const locEvents = events.filter(evt => this.eventBelongsToLocation(evt, loc));
      const withGps = locEvents.filter(evt => !!(evt.geoLocation && evt.geoLocation.trim())).length;
      const gpsCompliance = locEvents.length ? Math.round((withGps / locEvents.length) * 100) : 100;
      const late = locEvents.filter(evt => (evt.eventType || '').toLowerCase() === 'late').length;
      const breaches = Math.max(0, locEvents.length - withGps);

      return {
        name: loc.name,
        onShift: Math.max(0, Math.round(locEvents.length / 2) || (index + 1) * 4),
        late,
        gpsCompliance,
        geofenceBreaches: breaches
      };
    });
  }

  private eventBelongsToLocation(event: ShiftEvent, location: Location): boolean {
    if (!event.eventObject) {
      return false;
    }

    try {
      const parsed = JSON.parse(event.eventObject) as { name?: string; locationId?: number | string };
      const parsedId = Number(parsed.locationId);
      return parsed.name === location.name || parsedId === location.locationId;
    } catch {
      return event.eventObject.toLowerCase().includes(location.name.toLowerCase());
    }
  }

  private buildNotifications(gpsCompliance: number, overtimeRiskCount: number, clockEvents: number): OpsNotification[] {
    const dynamicItems: OpsNotification[] = [];

    if (gpsCompliance < 95) {
      dynamicItems.push({
        title: 'GPS Compliance Below Target',
        description: `Current compliance is ${gpsCompliance}%. Review geofence setup and mobile permissions.`,
        level: 'critical',
        ago: 'Live',
        icon: 'gpp_maybe'
      });
    }

    if (overtimeRiskCount > 0) {
      dynamicItems.push({
        title: 'Overtime Exposure Detected',
        description: `${overtimeRiskCount} team members show high shift-event activity today.`,
        level: 'warning',
        ago: 'Live',
        icon: 'alarm_on'
      });
    }

    dynamicItems.push({
      title: 'Clock Activity Snapshot',
      description: `${clockEvents} clock events have been captured so far today.`,
      level: 'info',
      ago: 'Live',
      icon: 'insights'
    });

    return dynamicItems;
  }

  getComplianceBackground(percent: number): string {
    return `conic-gradient(#0f766e 0% ${percent}%, #dbeafe ${percent}% 100%)`;
  }

  getLevelClass(level: OpsNotification['level']): string {
    return `level-${level}`;
  }

  getGpsRiskClass(location: LocationHealth): string {
    if (location.geofenceBreaches > 2 || location.gpsCompliance < 94) {
      return 'risk-high';
    }

    if (location.geofenceBreaches > 0 || location.gpsCompliance < 97) {
      return 'risk-medium';
    }

    return 'risk-low';
  }
}
