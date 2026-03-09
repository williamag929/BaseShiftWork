jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  getIdToken: jest.fn().mockResolvedValue('mock-token'),
}));
jest.mock('@/config/firebase', () => ({ auth: {} }));
jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { apiClient } from '../api-client';

describe('apiClient', () => {
  it('is defined', () => {
    expect(apiClient).toBeDefined();
  });

  it('has a get method', () => {
    expect(typeof apiClient.get).toBe('function');
  });

  it('has a post method', () => {
    expect(typeof apiClient.post).toBe('function');
  });

  it('has a put method', () => {
    expect(typeof apiClient.put).toBe('function');
  });

  it('has a delete method', () => {
    expect(typeof apiClient.delete).toBe('function');
  });
});
