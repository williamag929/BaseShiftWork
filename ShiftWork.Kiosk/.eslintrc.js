module.exports = {
  extends: ['expo'],
  ignorePatterns: ['node_modules/**', '.expo/**', 'dist/**'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.{ts,tsx,js}', '__mocks__/**', 'jest.setup.*'],
      env: { jest: true },
    },
  ],
};
