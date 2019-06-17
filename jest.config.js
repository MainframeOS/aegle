module.exports = {
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
