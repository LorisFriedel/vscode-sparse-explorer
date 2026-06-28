/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/__mocks__/vscode.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
};
