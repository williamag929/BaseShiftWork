import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { ToastrService } from 'ngx-toastr';
import { DocumentsComponent } from './documents.component';
import './documents.module';
import { DocumentService } from 'src/app/core/services/document.service';
import { LocationService } from 'src/app/core/services/location.service';
import { PermissionService } from 'src/app/core/services/permission.service';
import { selectActiveCompany } from 'src/app/store/company/company.selectors';
import { PagedResult } from 'src/app/core/models/paged-result.model';
import { Document } from 'src/app/core/models/document.model';
import { SharedModule } from 'src/app/shared/shared.module';

const doc = (id: number, over: Partial<Document> = {}): Document => ({
  documentId: `d${id}`, companyId: 'co-test', title: `Doc ${id}`, type: 'Manual', mimeType: 'application/pdf', fileSize: 2048,
  version: '1.0', accessLevel: 'Public', status: 'Active', uploadedByName: 'Admin',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over
});
const many = (n: number) => Array.from({ length: n }, (_, i) => doc(i + 1));
const paged = (items: Document[], totalCount = items.length): PagedResult<Document> => ({ items, totalCount, page: 1, pageSize: 25 });

describe('DocumentsComponent (Loqzen design system)', () => {
  let fixture: ComponentFixture<DocumentsComponent>;
  let svc: Record<string, jasmine.Spy>;
  const el = () => fixture.nativeElement as HTMLElement;
  const panel = () => document.querySelector('lz-side-panel [role="dialog"]') as HTMLElement | null;
  const dialog = () => document.querySelector('[role="alertdialog"]') as HTMLElement | null;
  const archiveBtn = (n: number) => el().querySelector(`[aria-label="Archive Doc ${n}"]`) as HTMLElement;
  const confirmBtn = () => Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.includes('Archive document'))!;

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function click(target: Element | null) {
    (target as HTMLElement).click();
    await settle();
  }
  async function type(selector: string, value: string) {
    const input = panel()!.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function setup(result: PagedResult<Document> | Observable<PagedResult<Document>>, opts: { page?: number } = {}) {
    svc = {
      getDocuments: jasmine.createSpy('getDocuments').and.returnValue(result instanceof Observable ? result : of(result)),
      getDocument: jasmine.createSpy('getDocument').and.returnValue(of({ presignedUrl: 'https://example.test/file' })),
      initiateUpload: jasmine.createSpy('initiateUpload').and.returnValue(of({ documentId: 'new', presignedUploadUrl: 'https://s3.test/put' })),
      uploadToS3: jasmine.createSpy('uploadToS3').and.returnValue(of(undefined)),
      confirmUpload: jasmine.createSpy('confirmUpload').and.returnValue(of(doc(99, { title: 'Uploaded doc' }))),
      archiveDocument: jasmine.createSpy('archiveDocument').and.returnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      declarations: [DocumentsComponent],
      imports: [ReactiveFormsModule, NoopAnimationsModule, SharedModule],
      providers: [
        provideMockStore({ selectors: [{ selector: selectActiveCompany, value: { companyId: 'co-test' } }] }),
        { provide: DocumentService, useValue: svc },
        { provide: LocationService, useValue: { getLocations: () => of([{ locationId: 7, name: 'HQ', status: 'Active' }]) } },
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: ToastrService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), warning: jasmine.createSpy('warning') } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(DocumentsComponent);
    if (opts.page) fixture.componentInstance.page = opts.page;
    await settle();
  }

  function chooseFile(name = 'manual.pdf') {
    const input = panel()!.querySelector('#fileInput') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['x'], name, { type: 'application/pdf' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }

  it('renders one h1 through lz-page-header and exactly one primary button', async () => {
    await setup(paged([doc(1)]));
    expect(el().querySelectorAll('h1').length).toBe(1);
    expect(el().querySelector('lz-page-header h1')!.textContent).toContain('Documents');
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    expect(el().querySelector('.page-container, .filter-bar, mat-paginator, mat-form-field')).toBeNull();
  });

  it('lists documents in lz-table-scroll with an access chip carrying text', async () => {
    await setup(paged([doc(1, { accessLevel: 'LocationOnly' })]));
    expect(el().querySelector('lz-table-scroll table')).not.toBeNull();
    el().querySelectorAll('thead th').forEach(th => expect(th.getAttribute('scope')).toBe('col'));
    expect(el().querySelector('tbody lz-status-chip')!.textContent!.trim()).toBe('Location only');
  });

  it('shows lz-empty-state with a focus-opening upload button when there are no documents', async () => {
    await setup(paged([]));
    expect(el().querySelector('lz-empty-state')).not.toBeNull();
    expect(el().querySelector('lz-table-scroll')).toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    const emptyAdd = el().querySelector('lz-empty-state button') as HTMLElement;
    emptyAdd.focus();
    await click(emptyAdd);
    await click(panel()!.querySelector('[aria-label="Close"]'));
    await settle();
    expect(document.activeElement).toBe(emptyAdd);
  });

  it('shows an lz-alert and no empty state when loading fails', async () => {
    await setup(throwError(() => new Error('boom')));
    expect(el().querySelector('lz-alert[role="alert"]')!.textContent).toContain('Could not load documents.');
    expect(el().querySelector('lz-empty-state')).toBeNull();
  });

  it('searching resets to page 1 and sends the term; filtered empty state has no upload button', async () => {
    await setup(paged(many(25), 120));
    svc['getDocuments'].and.returnValue(of(paged(many(25), 120)));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(fixture.componentInstance.page).toBe(2);
    svc['getDocuments'].and.returnValue(of(paged([])));
    const search = el().querySelector('#doc-search') as HTMLInputElement;
    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    await settle();
    await click(el().querySelector('[aria-label="Search"]'));
    const args = svc['getDocuments'].calls.mostRecent().args;
    expect(args[3]).toBe('nothing');
    expect(args[4]).toBe(1);
    expect(el().querySelector('lz-empty-state')!.textContent).toContain('Try adjusting your search filters.');
    expect(el().querySelector('lz-empty-state button')).toBeNull();
  });

  it('renders no form until the panel opens and only inside lz-side-panel', async () => {
    await setup(paged([doc(1)]));
    expect(el().querySelector('form')).toBeNull();
    expect(document.querySelector('form')).toBeNull();
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('form')).not.toBeNull();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(0);
    expect(panel()!.querySelectorAll('[variant="primary"]').length).toBe(1);
  });

  it('marks required fields through lz-field and makes Location required for location-only access', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    const required = () => Array.from(panel()!.querySelectorAll('lz-field')).filter(f => f.querySelector('label span[aria-hidden]')).map(f => f.querySelector('label')!.textContent!.trim());
    expect(required()).toEqual(['Title *', 'Version *', 'File *']);
    const access = panel()!.querySelector('#document-access') as HTMLSelectElement;
    access.value = 'LocationOnly';
    access.dispatchEvent(new Event('change'));
    await settle();
    expect(required()).toEqual(['Title *', 'Version *', 'Location scope *', 'File *']);
  });

  it('the dropzone is a real button that opens the file picker on click, Enter and Space', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    const zone = panel()!.querySelector('[data-testid="dropzone"]') as HTMLElement;
    expect(zone.tagName).toBe('BUTTON');
    expect(getComputedStyle(zone).display).not.toBe('none');
    expect(zone.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    const input = panel()!.querySelector('#fileInput') as HTMLInputElement;
    const picker = spyOn(input, 'click');
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(picker).toHaveBeenCalledTimes(1);
    zone.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(picker).toHaveBeenCalledTimes(2);
    zone.click();
    expect(picker).toHaveBeenCalledTimes(3);
  });

  it('marks the dropzone as required for assistive tech', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    expect(panel()!.querySelector('[data-testid="dropzone"]')!.getAttribute('aria-required')).toBe('true');
  });

  it('dropping a file sets selectedFile only and does not start an upload', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    const transfer = new DataTransfer();
    transfer.items.add(new File(['x'], 'dropped.pdf', { type: 'application/pdf' }));
    const event = new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true });
    panel()!.querySelector('[data-testid="dropzone"]')!.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBeTrue();
    expect(fixture.componentInstance.selectedFile!.name).toBe('dropped.pdf');
    expect(svc['initiateUpload']).not.toHaveBeenCalled();
  });

  it('clears the hidden file input after cancel and after a successful upload', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    let input = panel()!.querySelector('#fileInput') as HTMLInputElement;
    chooseFile();
    await settle();
    expect(input.value).not.toBe('');
    fixture.componentInstance.cancelUpload();
    await settle();
    expect(input.value).toBe('');
    expect(fixture.componentInstance.selectedFile).toBeNull();

    await click(el().querySelector('lz-page-header button'));
    input = panel()!.querySelector('#fileInput') as HTMLInputElement;
    await type('#document-title', 'Manual');
    chooseFile();
    await settle();
    expect(input.value).not.toBe('');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(input.value).toBe('');
  });

  it('changing the type or location filter resets to page 1', async () => {
    await setup(paged(many(25), 120));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(fixture.componentInstance.page).toBe(2);
    const type = el().querySelector('#doc-filter-type') as HTMLSelectElement;
    type.value = 'Manual';
    type.dispatchEvent(new Event('change'));
    await settle();
    expect(fixture.componentInstance.page).toBe(1);
    expect(svc['getDocuments'].calls.mostRecent().args[2]).toBe('Manual');
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(fixture.componentInstance.page).toBe(2);
    const loc = el().querySelector('#doc-filter-location') as HTMLSelectElement;
    loc.selectedIndex = 1;
    loc.dispatchEvent(new Event('change'));
    await settle();
    expect(fixture.componentInstance.page).toBe(1);
    expect(svc['getDocuments'].calls.mostRecent().args[1]).toBe(7);
  });

  it('uploads through the presigned S3 flow and closes the panel', async () => {
    await setup(paged([]));
    await click(el().querySelector('lz-page-header button'));
    await type('#document-title', 'Manual');
    chooseFile();
    await settle();
    expect(panel()!.querySelector('[data-testid="dropzone"]')!.textContent).toContain('manual.pdf');
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(svc['initiateUpload']).toHaveBeenCalled();
    expect(svc['uploadToS3']).toHaveBeenCalledWith('https://s3.test/put', jasmine.any(File));
    expect(svc['confirmUpload']).toHaveBeenCalledWith('co-test', 'new');
    expect(panel()).toBeNull();
    expect(el().textContent).toContain('Uploaded doc');
  });

  it('a failed upload keeps the panel open and toasts an error', async () => {
    await setup(paged([]));
    svc['uploadToS3'].and.returnValue(throwError(() => new Error('boom')));
    await click(el().querySelector('lz-page-header button'));
    await type('#document-title', 'Manual');
    chooseFile();
    await settle();
    await click(panel()!.querySelector('button[type="submit"]'));
    expect(panel()).not.toBeNull();
    expect((TestBed.inject(ToastrService) as any).error).toHaveBeenCalledWith('Could not upload the file.');
    expect(svc['confirmUpload']).not.toHaveBeenCalled();
  });

  it('renders only 25 rows when the server reports 120 and requests the next page', async () => {
    await setup(paged(many(25), 120));
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
    expect(el().querySelector('lz-pager')!.textContent).toContain('1–25 of 120');
    svc['getDocuments'].and.returnValue(of(paged([doc(26)], 120)));
    await click(el().querySelector('lz-pager [aria-label="Next page"]'));
    expect(svc['getDocuments'].calls.mostRecent().args.slice(4)).toEqual([2, 25]);
  });

  it('clamps an out-of-range page after load by reloading the last page', async () => {
    await setup(paged([], 25), { page: 3 });
    expect(svc['getDocuments'].calls.allArgs().map((a: any[]) => a[4])).toEqual([3, 1]);
    expect(fixture.componentInstance.page).toBe(1);
  });

  it('archiving the only row on the last page falls back one page', async () => {
    await setup(paged([doc(26)], 26), { page: 2 });
    svc['getDocuments'].and.returnValue(of(paged(many(25), 25)));
    await click(archiveBtn(26));
    await click(confirmBtn());
    expect(fixture.componentInstance.page).toBe(1);
    expect(svc['getDocuments'].calls.mostRecent().args.slice(4)).toEqual([1, 25]);
    expect(el().querySelectorAll('tbody tr').length).toBe(25);
  });

  it('archiving asks in an alertdialog and only archives after confirming', async () => {
    await setup(paged([doc(1)]));
    await click(archiveBtn(1));
    expect(dialog()!.textContent).toContain('Archive Doc 1?');
    expect(svc['archiveDocument']).not.toHaveBeenCalled();
    expect(el().querySelectorAll('[variant="primary"]').length).toBe(1);
    await click(confirmBtn());
    expect(svc['archiveDocument']).toHaveBeenCalledWith('co-test', 'd1');
    expect(dialog()).toBeNull();
  });

  it('Cancel and Escape close the archive dialog and return focus to the trigger', async () => {
    await setup(paged([doc(1)]));
    const trigger = archiveBtn(1);
    trigger.focus();
    await click(trigger);
    await click(Array.from(dialog()!.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Cancel')!);
    expect(document.activeElement).toBe(trigger);
    await click(trigger);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialog()).toBeNull();
    expect(svc['archiveDocument']).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it('a failed archive keeps the row, toasts an error and refocuses the trigger', async () => {
    await setup(paged([doc(1)]));
    svc['archiveDocument'].and.returnValue(throwError(() => new Error('boom')));
    const trigger = archiveBtn(1);
    trigger.focus();
    await click(trigger);
    await click(confirmBtn());
    expect(dialog()).toBeNull();
    expect(el().querySelectorAll('tbody tr').length).toBe(1);
    expect((TestBed.inject(ToastrService) as any).error).toHaveBeenCalledWith('Could not archive the document.');
    expect(document.activeElement).toBe(trigger);
  });

  it('after a successful archive focus moves to the Upload button', async () => {
    await setup(paged([doc(1)]));
    await click(archiveBtn(1));
    await click(confirmBtn());
    await settle();
    expect(document.activeElement).toBe(el().querySelector('lz-page-header button'));
  });

  it('opening from a row action opens once, not twice', async () => {
    spyOn(window, 'open');
    await setup(paged([doc(1)]));
    await click(el().querySelector('[aria-label="Open Doc 1"]'));
    expect(svc['getDocument']).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledTimes(1);
    await click(el().querySelector('tbody tr'));
    expect(svc['getDocument']).toHaveBeenCalledTimes(2);
  });

  it('keeps row action targets at 48px and the heading at 26px', async () => {
    await setup(paged([doc(1)]));
    const box = archiveBtn(1).getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(getComputedStyle(el().querySelector('h1')!).fontSize).toBe('26px');
  });

  for (const width of [360, 768]) {
    it(`contains the table inside lz-table-scroll without page overflow at ${width}px`, async () => {
      await setup(paged(many(3)));
      const host = el();
      host.style.display = 'block';
      host.style.width = `${width}px`;
      const scroll = host.querySelector('lz-table-scroll') as HTMLElement;
      expect(getComputedStyle(scroll).overflowX).toBe('auto');
      expect(scroll.clientWidth).toBeLessThanOrEqual(width);
      expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
    });
  }
});
