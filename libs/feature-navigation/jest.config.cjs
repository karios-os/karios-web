const path = require('path');
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../tsconfig.base.json');

module.exports = {
  displayName: 'feature-navigation',
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { 
      tsconfig: '<rootDir>/tsconfig.json',
      isolatedModules: true,
      diagnostics: {
        ignoreCodes: [2339, 4111] // Ignore property errors during testing
      }
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, {
      prefix: '<rootDir>/../../',
    }),
    '^@karios-monorepo/(.*)$': '<rootDir>/../../libs/$1/src',
    // Mock env.config to avoid import.meta issues in tests
    '^(.*/)?env\\.config$': '<rootDir>/../../__mocks__/env.config.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.cjs'],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../../coverage/libs/feature-navigation',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/index.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@nx|@karios-monorepo))',
  ],
  moduleDirectories: ['node_modules', '<rootDir>', '<rootDir>/../../'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
}