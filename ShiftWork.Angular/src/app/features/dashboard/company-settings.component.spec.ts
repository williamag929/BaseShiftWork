import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockStore } from '@ngrx/store/testing';
import { Observable, of, throwError } from 'rxjs';
import { CompanySettingsService } from 'src/app/core/services/company-settings.service';
import { CompanySettings } from 'src/app/core/models/company-settings.model';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PermissionService } from 'src/app/core/services/permission.service';
import { KioskService } from '../kiosk/core/services/kiosk.service';
import { KioskQuestion } from '../kiosk/core/models/kiosk-question.model';
import { CompanySettingsComponent } from './company-settings.component';

const settings = (): CompanySettings => ({
  settingsId: 1, companyId: 'c1',
  defaultTimeZone: 'America/New_York', defaultLanguage: 'es', firstDayOfWeek: 'Monday', dateFormat: 'DD/MM/YYYY', timeFormat: '24', currencySymbol: '€',
  minimumHourlyRate: 17.5, regularOvertimePercentage: 150, nightShiftOvertimePercentage: 160, holidayOvertimePercentage: 200, weekendOvertimePercentage: 175,
  nightShiftStartTime: '22:00', nightShiftEndTime: '06:00', dailyOvertimeThreshold: 8, weeklyOvertimeThreshold: 40,
  defaultPtoAccrualRate: 6.5, maximumPtoBalance: 120, ptoRolloverAllowed: true, maximumPtoRollover: 40, sickLeaveAccrualRate: 3, sickLeaveMaximumBalance: 80,
  requireManagerApprovalForPto: true, minimumNoticeDaysForPto: 7,
  autoApproveShifts: true, allowEmployeeShiftSwaps: true, requireManagerApprovalForSwaps: true, maximumConsecutiveWorkDays: 6, minimumHoursBetweenShifts: 10,
  maximumDailyHours: 12, maximumWeeklyHours: 60, allowOverlappingShifts: true,
  gracePeriodLateClockIn: 5, autoClockOutAfter: 14, requireGeoLocationForClockIn: true, geoFenceRadius: 150, allowEarlyClockIn: 10, requireBreakClocks: true,
  minimumBreakDuration: 30,
  emailNotificationsEnabled: true, smsNotificationsEnabled: true, pushNotificationsEnabled: true, notifyOnShiftAssignment: true, notifyOnShiftChanges: true,
  notifyOnTimeOffApproval: true, notifyOnReplacementRequest: true, reminderHoursBeforeShift: 3,
  fiscalYearStartMonth: 4, payrollPeriod: 'BiWeekly', employeeIdPrefix: 'MRS', requireTwoFactorAuth: true, sessionTimeout: 45, passwordExpirationDays: 90,
  minimumPasswordLength: 12,
  kioskModeEnabled: true, kioskPinLength: 6, requirePhotoOnClockIn: true, showEmployeePhotosOnKiosk: true, kioskTimeout: 45, allowQuestionResponsesOnClockIn: true,
});

const question = (id: number, text = `Question ${id}`): KioskQuestion => ({
  kioskQuestionId: id, questionText: text, companyId: 1, isActive: true, questionType: 'yes_no', isRequired: false, displayOrder: id,
});

describe('CompanySettingsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<CompanySettingsComponent>;
  let settingsService: Record<string, jasmine.Spy>;
  let kiosk: Record<string, jasmine.Spy>;
  let snack: { open: jasmine.Spy };
  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => selectActiveCompany.clearResult());

  async function setup(opts: { settings?: Observable<CompanySettings>; questions?: KioskQuestion[] | Observable<KioskQuestion[]>; company?: any; perms?: string[] } = {}) {
    settingsService = {
      getSettings: jasmine.createSpy('getSettings').and.returnValue(opts.settings ?? of(settings())),
      updateSettings: jasmine.createSpy('updateSettings').and.returnValue(of(undefined)),
    };
    const q = opts.questions ?? [];
    kiosk = {
      getManagementQuestions: jasmine.createSpy('getManagementQuestions').and.returnValue(Array.isArray(q) ? of(q) : q),
      createQuestion: jasmine.createSpy('createQuestion').and.callFake((_c: string, dto: any) => of({ ...question(99), ...dto, kioskQuestionId: 99 })),
      updateQuestion: jasmine.createSpy('updateQuestion').and.callFake((_c: string, id: number, dto: any) => of({ ...question(id), ...dto })),
      deleteQuestion: jasmine.createSpy('deleteQuestion').and.returnValue(of(undefined)),
    };
    snack = { open: jasmine.createSpy('open') };
    await TestBed.configureTestingModule({
      imports: [CompanySettingsComponent],
      providers: [
        provideNoopAnimations(),
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: opts.company === undefined ? { companyId: 'c1' } : opts.company }] }),
        { provide: CompanySettingsService, useValue: settingsService },
        { provide: KioskService, useValue: kiosk },
        { provide: PermissionService, useValue: { hasPermission: (k: string) => (opts.perms ?? ['kiosk.questions.manage']).includes(k) } },
      ],
    }).overrideProvider(MatSnackBar, { useValue: snack }).compileComponents();
    fixture = TestBed.createComponent(CompanySettingsComponent);
    await settle();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const click = async (target: Element | null) => {
    (target as HTMLElement).click();
    await settle();
  };
  const byText = (root: ParentNode, text: string) => Array.from(root.querySelectorAll('button')).find(b => b.textContent!.includes(text))!;

  it('renders one h1 and a single primary Save changes button for the whole form', async () => {
    await setup();
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Company settings');
    const primaries = el().querySelectorAll('[variant="primary"]');
    expect(primaries.length).toBe(1);
    expect(primaries[0].textContent).toContain('Save changes');
    expect(primaries[0].getAttribute('form')).toBe('company-settings-form');
    expect(el().querySelector('form#company-settings-form')).not.toBeNull();
    expect(el().querySelector('.tabs, .tab, .settings-section, .form-group, .btn-save')).toBeNull();
  });

  it('groups fields into the Company, Time and pay, Notifications and Integrations sections', async () => {
    await setup();
    const headings = Array.from(el().querySelectorAll('lz-panel h2')).map(h => h.textContent!.trim());
    expect(headings).toEqual(['Company', 'Time and pay', 'Notifications', 'Integrations']);
    const sectionOf = (id: string) => el().querySelector(`#${id}`)!.closest('lz-panel')!.querySelector('h2')!.textContent!.trim();
    expect(sectionOf('defaultTimeZone')).toBe('Company');
    expect(sectionOf('requireTwoFactorAuth')).toBe('Company');
    expect(sectionOf('minimumHourlyRate')).toBe('Time and pay');
    expect(sectionOf('autoApproveShifts')).toBe('Time and pay');
    expect(sectionOf('gracePeriodLateClockIn')).toBe('Time and pay');
    expect(sectionOf('emailNotificationsEnabled')).toBe('Notifications');
    expect(sectionOf('kioskModeEnabled')).toBe('Integrations');
  });

  it('keeps every settings field bound and saves the same payload, with a representative value in every section', async () => {
    await setup();
    const expected = settings();
    const bound = Array.from(el().querySelectorAll('form#company-settings-form [id]'))
      .filter(n => /^(INPUT|SELECT)$/.test(n.tagName)).map(n => n.id);
    const model = Object.keys(expected).filter(k => k !== 'settingsId' && k !== 'companyId');
    const optional = ['kioskAdminPassword'];
    for (const key of model) {
      expect(bound).withContext(`field ${key}`).toContain(key);
    }
    expect(bound).toContain(optional[0]);

    const set = async (id: string, value: string) => {
      const input = el().querySelector(`#${id}`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
      await settle();
    };
    await set('currencySymbol', '£');
    await set('weeklyOvertimeThreshold', '44');
    await set('allowEarlyClockIn', '15');
    await set('reminderHoursBeforeShift', '5');
    await set('kioskPinLength', '8');
    await set('kioskAdminPassword', 'new-secret');
    await click(el().querySelector('#autoApproveShifts'));
    (el().querySelector('[variant="primary"]') as HTMLElement).click();
    await settle();

    expect(settingsService['updateSettings']).toHaveBeenCalledTimes(1);
    const [companyId, payload] = settingsService['updateSettings'].calls.mostRecent().args;
    expect(companyId).toBe('c1');
    expect(payload).toEqual({
      ...expected,
      currencySymbol: '£',
      weeklyOvertimeThreshold: 44,
      allowEarlyClockIn: 15,
      reminderHoursBeforeShift: 5,
      kioskPinLength: 8,
      kioskAdminPassword: 'new-secret',
      autoApproveShifts: false,
    });
    expect(snack.open).toHaveBeenCalledWith('Settings saved.', 'Close', { duration: 3000 });
  });

  it('shows conditional fields only while their parent option is on', async () => {
    await setup();
    expect(el().querySelector('#maximumPtoRollover')).not.toBeNull();
    await click(el().querySelector('#ptoRolloverAllowed'));
    expect(el().querySelector('#maximumPtoRollover')).toBeNull();
    expect(el().querySelector('#geoFenceRadius')).not.toBeNull();
    await click(el().querySelector('#requireGeoLocationForClockIn'));
    expect(el().querySelector('#geoFenceRadius')).toBeNull();
  });

  it('labels every control and gives checkboxes and other targets accessible sizes', async () => {
    await setup();
    const controls = Array.from(el().querySelectorAll('form#company-settings-form input, form#company-settings-form select'));
    for (const c of controls) {
      const labelled = c.closest('label') || el().querySelector(`label[for="${c.id}"]`);
      expect(labelled).withContext(c.id).not.toBeNull();
    }
    const check = el().querySelector('#autoApproveShifts') as HTMLElement;
    expect(check.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    expect((check.closest('label') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect((el().querySelector('#defaultTimeZone') as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
    expect(el().textContent).not.toMatch(/Time & Regional|Pay & Overtime/);
  });

  it('shows a load alert and no empty state when settings fail to load', async () => {
    await setup({ settings: throwError(() => ({ status: 500 })) });
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not load company settings');
    expect(el().querySelector('lz-empty-state')).toBeNull();
    expect(el().querySelector('[variant="primary"]')).toBeNull();
  });

  it('shows the empty state without an alert when no company is selected', async () => {
    await setup({ company: null });
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-alert[role="alert"]')).toBeNull();
    expect(el().querySelectorAll('h1').length).toBe(1);
  });

  it('reports a failed save through the snackbar and re-enables saving', async () => {
    await setup();
    settingsService['updateSettings'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('[variant="primary"]'));
    expect(snack.open).toHaveBeenCalledWith('Could not save settings.', 'Close', { duration: 3000 });
    expect((el().querySelector('[variant="primary"]') as HTMLButtonElement).disabled).toBeFalse();
  });

  describe('clock-out survey questions', () => {
    it('shows the empty state with an add action that opens the dialog and restores focus on cancel', async () => {
      await setup({ questions: [] });
      const empty = el().querySelector('lz-empty-state')!;
      const add = empty.querySelector('button') as HTMLElement;
      add.focus();
      await click(add);
      expect(document.querySelector('lz-dialog-overlay [role="dialog"]')).not.toBeNull();
      expect(document.querySelectorAll('[variant="primary"]').length).toBe(1);
      expect(el().querySelector('lz-page-header [form="company-settings-form"]')!.getAttribute('variant')).toBe('secondary');
      await click(byText(document.querySelector('lz-dialog-overlay')!, 'Cancel'));
      await settle();
      expect(document.querySelector('lz-dialog-overlay')).toBeNull();
      expect(document.activeElement).toBe(add);
    });

    it('Escape closes the question dialog and returns focus to the edit button that opened it', async () => {
      await setup({ questions: [question(1)] });
      const opener = el().querySelector('[aria-label="Edit Question 1"]') as HTMLElement;
      opener.focus();
      await click(opener);
      expect(document.querySelector('lz-dialog-overlay')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      await settle();
      expect(document.querySelector('lz-dialog-overlay')).toBeNull();
      expect(kiosk['updateQuestion']).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(opener);
    });

    it('with kiosk.questions.manage it requests the questions and shows the block', async () => {
      await setup({ questions: [question(1)] });
      expect(kiosk['getManagementQuestions']).toHaveBeenCalledWith('c1');
      expect(el().textContent).toContain('Clock-out survey questions');
    });

    it('without kiosk.questions.manage it never requests the questions and hides the block', async () => {
      await setup({ questions: [question(1)], perms: [] });
      expect(kiosk['getManagementQuestions']).not.toHaveBeenCalled();
      expect(el().textContent).not.toContain('Clock-out survey questions');
      expect(el().querySelector('#kioskModeEnabled')).not.toBeNull();
    });

    it('a 403 on the questions shows an inline message, no toast, and the rest of the form still saves', async () => {
      await setup({ questions: throwError(() => ({ status: 403 })) });
      expect(el().textContent).toContain('Could not load kiosk questions.');
      expect(snack.open).not.toHaveBeenCalled();
      const save = el().querySelector('[variant="primary"]') as HTMLButtonElement;
      expect(save.disabled).toBeFalse();
      await click(save);
      expect(settingsService['updateSettings']).toHaveBeenCalled();
    });

    it('creates a question from the dialog and requires the text', async () => {
      await setup({ questions: [] });
      await click(el().querySelector('lz-empty-state button'));
      const dialog = document.querySelector('lz-dialog-overlay') as HTMLElement;
      const save = dialog.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(save.disabled).toBeTrue();
      const input = dialog.querySelector('#q-text') as HTMLInputElement;
      input.value = 'Any incidents today?';
      input.dispatchEvent(new Event('input'));
      await settle();
      expect(save.disabled).toBeFalse();
      await click(save);
      expect(kiosk['createQuestion']).toHaveBeenCalled();
      expect(kiosk['createQuestion'].calls.mostRecent().args[1].questionText).toBe('Any incidents today?');
      expect(document.querySelector('lz-dialog-overlay')).toBeNull();
      expect(el().querySelectorAll('tbody tr').length).toBe(1);
    });

    it('keeps the dialog open and shows an alert when saving a question fails', async () => {
      await setup({ questions: [question(1)] });
      kiosk['updateQuestion'].and.returnValue(throwError(() => new Error('boom')));
      await click(el().querySelector('[aria-label="Edit Question 1"]'));
      await click(document.querySelector('lz-dialog-overlay button[type="submit"]'));
      expect(document.querySelector('lz-dialog-overlay')).not.toBeNull();
      expect(document.querySelector('lz-dialog-overlay lz-alert[role="alert"]')!.textContent).toContain('Could not update the question');
    });

    it('deleting asks in an alertdialog and only deletes after confirming', async () => {
      await setup({ questions: [question(1, 'Slips or falls?')] });
      await click(el().querySelector('[aria-label="Delete Slips or falls?"]'));
      const dialog = document.querySelector('[role="alertdialog"]') as HTMLElement;
      expect(dialog.textContent).toContain('Delete Slips or falls??');
      expect(kiosk['deleteQuestion']).not.toHaveBeenCalled();
      await click(byText(dialog, 'Delete question'));
      expect(kiosk['deleteQuestion']).toHaveBeenCalledWith('c1', 1);
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(el().querySelector('lz-empty-state')).not.toBeNull();
    });

    it('Cancel and Escape close the delete dialog without deleting and return focus to the delete button', async () => {
      await setup({ questions: [question(1, 'Slips or falls?')] });
      const trigger = el().querySelector('[aria-label="Delete Slips or falls?"]') as HTMLElement;
      trigger.focus();
      await click(trigger);
      await click(byText(document.querySelector('[role="alertdialog"]')!, 'Cancel'));
      await settle();
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      await click(trigger);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(document.querySelector('[role="alertdialog"]')).toBeNull();
      expect(kiosk['deleteQuestion']).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(trigger);
    });

    it('a failed delete keeps the row, reports the error and refocuses the delete button', async () => {
      await setup({ questions: [question(1, 'Slips or falls?')] });
      kiosk['deleteQuestion'].and.returnValue(throwError(() => new Error('boom')));
      const trigger = el().querySelector('[aria-label="Delete Slips or falls?"]') as HTMLElement;
      trigger.focus();
      await click(trigger);
      await click(byText(document.querySelector('[role="alertdialog"]')!, 'Delete question'));
      await settle();
      expect(el().querySelectorAll('tbody tr').length).toBe(1);
      expect(snack.open).toHaveBeenCalledWith('Could not delete the question.', 'Close', { duration: 3000 });
      expect(document.activeElement).toBe(trigger);
    });

    it('pages more than 25 questions and falls back a page when the last one is deleted', async () => {
      const many = Array.from({ length: 26 }, (_, i) => question(i + 1));
      await setup({ questions: many });
      expect(el().querySelectorAll('tbody tr').length).toBe(25);
      await click(el().querySelector('lz-pager [aria-label="Next page"]'));
      expect(el().querySelectorAll('tbody tr').length).toBe(1);
      await click(el().querySelector('[aria-label="Delete Question 26"]'));
      await click(byText(document.querySelector('[role="alertdialog"]')!, 'Delete question'));
      expect(fixture.componentInstance.qPage).toBe(1);
      expect(el().querySelectorAll('tbody tr').length).toBe(25);
    });

    it('lists questions in lz-table-scroll with required and state chips', async () => {
      await setup({ questions: [question(1), { ...question(2), isRequired: true, isActive: false }] });
      const rows = el().querySelectorAll('lz-table-scroll tbody tr');
      expect(rows.length).toBe(2);
      expect(Array.from(rows[1].querySelectorAll('lz-status-chip')).map(c => c.textContent!.trim())).toEqual(['Required', 'Inactive']);
      expect(rows[0].querySelector('lz-status-chip')!.textContent!.trim()).toBe('Active');
    });

    it('shows the load alert and not the empty state when the questions fail to load', async () => {
      await setup({ questions: throwError(() => new Error('boom')) });
      expect(el().querySelector('lz-empty-state')).toBeNull();
      expect(el().textContent).toContain('Could not load kiosk questions.');
    });
  });
});
