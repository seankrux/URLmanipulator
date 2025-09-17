/** Optional Jest config. Install dev deps before running tests:
 *   npm i -D jest @jest-environment/jsdom
 */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  roots: ['.'],
};

