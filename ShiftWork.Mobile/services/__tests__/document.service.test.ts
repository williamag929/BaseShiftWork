jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../api-client';
import { documentService, Document, DocumentDetail } from '../document.service';

const mockGet = apiClient.get as jest.Mock;

const MOCK_DOC: Document = {
  documentId: 'd1', companyId: 'co-1', title: 'Safety Manual', type: 'Manual',
  mimeType: 'application/pdf', fileSize: 2048, version: '1.0',
  accessLevel: 'Public', status: 'Active', uploadedByName: 'Admin',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_DETAIL: DocumentDetail = {
  ...MOCK_DOC,
  presignedUrl: 'https://s3.example.com/presigned/doc.pdf',
  totalReads: 12,
};

beforeEach(() => jest.clearAllMocks());

describe('documentService.getDocuments', () => {
  it('calls correct endpoint and returns document list', async () => {
    mockGet.mockResolvedValue([MOCK_DOC]);

    const result = await documentService.getDocuments('co-1');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/documents', { params: {} });
    expect(result).toEqual([MOCK_DOC]);
  });

  it('includes optional filters in params', async () => {
    mockGet.mockResolvedValue([]);

    await documentService.getDocuments('co-1', 3, 'Manual', 'safety');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/documents', {
      params: { locationId: 3, type: 'Manual', search: 'safety' },
    });
  });

  it('propagates error on load failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(documentService.getDocuments('co-1')).rejects.toThrow('Network error');
  });
});

describe('documentService.getById', () => {
  it('calls correct endpoint and returns document detail with presigned URL', async () => {
    mockGet.mockResolvedValue(MOCK_DETAIL);

    const result = await documentService.getById('co-1', 'd1');

    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/documents/d1');
    expect(result.presignedUrl).toBe('https://s3.example.com/presigned/doc.pdf');
  });

  it('propagates error when document not found', async () => {
    mockGet.mockRejectedValue(new Error('Not found'));

    await expect(documentService.getById('co-1', 'nonexistent')).rejects.toThrow('Not found');
  });
});
