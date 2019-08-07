module.exports = {
  extends: ['mainframe', 'mainframe/jest', 'mainframe/typescript'],
  rules: {
    '@typescript-eslint/camelcase': {
      ignoreDestructuring: true,
    },
    '@typescript-eslint/explicit-function-return-type': {
      allowExpressions: true,
    },
    '@typescript-eslint/no-unused-vars': {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    },
  },
}
