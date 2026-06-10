jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../api-client';
import { dailyReportService, DailyReport } from '../daily-report.service';

const mockGet = apiClient.get as jest.Mock;
const mockPut = apiClient.put as jest.Mock;

const MOCK_REPORT: DailyReport = {
  reportId: 'r1', companyId: 'co-1', locationId: 1, reportDate: '2026-04-30',
  totalEmployees: 5, totalHours: 40, status: 'Draft', notes: 'All clear.',
  media: [], createdAt: '2026-04-30T00:00:00Z', updatedAt: '2026-04-30T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('dailyReportService.getReport', () => {
  it('calls correct endpoint and returns report', async () => {
    mockGet.mockResolvedValue(MOCK_REPORT);

    const result = await dailyReportService.getReport('co-1', 1, '2026-04-30');

    expect(mockGet).toHaveBeenCalledWith(
      '/api/companies/co-1/locations/1/daily-reports/2026-04-30'
    );
    expect(result).toEqual(MOCK_REPORT);
  });

  it('propagates error when report not found', async () => {
    mockGet.mockRejectedValue(new Error('Not found'));

    await expect(dailyReportService.getReport('co-1', 1, '2026-04-30')).rejects.toThrow('Not found');
  });
});

describe('dailyReportService.updateReport', () => {
  it('PUTs draft status with notes', async () => {
    const draftReport = { ...MOCK_REPORT, status: 'Draft', notes: 'Updated notes' };
    mockPut.mockResolvedValue(draftReport);

    const result = await dailyReportService.updateReport('co-1', 1, 'r1', 'Updated notes', 'Draft');

    expect(mockPut).toHaveBeenCalledWith(
      '/api/companies/co-1/locations/1/daily-reports/r1',
      { notes: 'Updated notes', status: 'Draft' }
    );
    expect(result.status).toBe('Draft');
  });

  it('PUTs submitted status', async () => {
    const submittedReport = { ...MOCK_REPORT, status: 'Submitted' };
    mockPut.mockResolvedValue(submittedReport);

    const result = await dailyReportService.updateReport('co-1', 1, 'r1', 'All clear.', 'Submitted');

    expect(mockPut).toHaveBeenCalledWith(
      '/api/companies/co-1/locations/1/daily-reports/r1',
      { notes: 'All clear.', status: 'Submitted' }
    );
    expect(result.status).toBe('Submitted');
  });

  it('propagates error when update fails', async () => {
    mockPut.mockRejectedValue(new Error('Server error'));

    await expect(
      dailyReportService.updateReport('co-1', 1, 'r1', null, 'Draft')
    ).rejects.toThrow('Server error');
  });
});
