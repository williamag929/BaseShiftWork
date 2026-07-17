import 'zone.js/testing';
// Provides the global `$localize` used by i18n-marked templates. The production/dev
// builds supply this via angular.json's `localize` option; Karma does not, so without
// this import every component with an `i18n` attribute throws "$localize is not defined".
import '@angular/localize/init';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

// Explicitly import spec files to avoid require.context issues in some builds.
import './app/core/guards/auth.guard.spec';
import './app/features/company-switch/company-switch.component.spec';
import './app/features/dashboard/shiftsummaries/shiftsummaries.component.spec';
import './app/features/dashboard/schedules/schedule-edit/schedule-edit.component.spec';
import './app/features/admin/components/company-form/company-form.component.spec';
import './app/core/services/bulletin.service.spec';
import './app/core/services/safety.service.spec';
import './app/features/dashboard/bulletins/bulletins.component.spec';
import './app/features/dashboard/daily-reports/daily-reports.component.spec';
import './app/features/dashboard/documents/documents.component.spec';
import './app/features/dashboard/safety/safety.component.spec';
import './app/features/kiosk/audit-history/audit-history.spec';
import './app/features/kiosk/kiosk.component.spec';
import './app/features/kiosk/photo-schedule/photo-schedule.component.spec';
