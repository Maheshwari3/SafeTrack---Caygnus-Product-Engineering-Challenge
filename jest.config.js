module.exports = {
  preset: 'react-native',

  testPathIgnorePatterns: [
    '/node_modules/',
    '/backend/',
  ],

  setupFiles: [
    '<rootDir>/jest.setup.js',
  ],
};