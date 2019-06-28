module.exports = {
  collectCoverage: true,
  globals: {
    'ts-jest': {
      diagnostics: false,
    },
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
}
