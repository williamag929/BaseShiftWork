jest.mock('../api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../api-client';
import { credentialService } from '../credential.service';
import type { CredentialDto } from '../../types/api';

const mockGet = apiClient.get as jest.Mock;

const MOCK_CREDENTIAL: CredentialDto = {
  credentialId: 'c1',
  companyId: 'co-1',
  personId: 42,
  personName: 'Jane Doe',
  name: 'OSHA 30',
  type: 'Certification',
  expiryDate: '2026-12-01T00:00:00Z',
  expiryStatus: 'Valid',
  hasDocument: false,
  status: 'Active',
  createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => jest.clearAllMocks());

describe('credentialService.getMyCredentials', () => {
  it('calls the person-scoped endpoint and returns the credential list', async () => {
    mockGet.mockResolvedValue([MOCK_CREDENTIAL]);

    const result = await credentialService.getMyCredentials('co-1', 42);

    expect(mockGet).toHaveBeenCalledWith(
      '/api/companies/co-1/credentials/person/42',
      { params: { noCacheBust: true } }
    );
    expect(result).toEqual([MOCK_CREDENTIAL]);
  });

  it('propagates error on load failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await expect(credentialService.getMyCredentials('co-1', 42)).rejects.toThrow('Network error');
  });
});
