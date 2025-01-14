/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    "^.+.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.json",
    }],
  },
  moduleNameMapper: {
    "\\.(css|less|scss|sass|txt|png|conf|dssh|md)$": "identity-obj-proxy",
    "^@xterm/addon-webgl$": "<rootDir>/__mocks__/@xterm/addon-webgl.js",
    "^@xterm/addon-fit$": "<rootDir>/__mocks__/@xterm/addon-fit.js",
  },
};