module.exports = {
  extends: ['mainframe', 'mainframe/jest', 'mainframe/typescript'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': {
      allowExpressions: true,
    },
  },
}
