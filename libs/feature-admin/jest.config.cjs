const path = require('path');
const baseConfig = require('../../jest.config.cjs');

module.exports = {
  ...baseConfig,
  displayName: 'feature-admin',
  rootDir: path.resolve(__dirname, '../..'),
  testMatch: ['<rootDir>/libs/feature-admin/**/*.(test|spec).(ts|tsx|js)'],
  collectCoverageFrom: [
    'libs/feature-admin/src/**/*.{ts,tsx}',
    '!libs/feature-admin/src/**/*.d.ts',
    '!libs/feature-admin/src/**/*.spec.{ts,tsx}',
    '!libs/feature-admin/src/**/*.test.{ts,tsx}',
    '!libs/feature-admin/src/index.ts',
  ],
  coverageDirectory: 'coverage/libs/feature-admin',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],
};
