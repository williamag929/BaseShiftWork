jest.mock('../api-client', () => ({
  apiClient: { get: jest.fn() },
}));

import { apiClient } from '../api-client';
import { companyUserService } from '../company-user.service';

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('companyUserService.getMyClaims', () => {
  it('calls the claims endpoint and returns the payload', async () => {
    const claims = {
      companyId: 'co-1', userId: 'u-1', roles: ['Manager'],
      permissions: ['lineup.view'], permissionsVersion: 3,
    };
    mockGet.mockResolvedValue(claims);
    await expect(companyUserService.getMyClaims('co-1')).resolves.toEqual(claims);
    expect(mockGet).toHaveBeenCalledWith('/api/companies/co-1/users/me/claims');
  });

  it('propagates errors', async () => {
    mockGet.mockRejectedValue(new Error('boom'));
    await expect(companyUserService.getMyClaims('co-1')).rejects.toThrow('boom');
  });
});
