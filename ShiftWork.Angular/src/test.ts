import 'zone.js/testing';
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
