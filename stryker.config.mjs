export default {
  mutate: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
  ],
  mutator: {
    name: "typescript",
  },
  testRunner: "vitest",
  reporters: ["progress", "clear-text", "html"],
  coverageAnalysis: "off",
  testFiles: ["src/**/*.test.ts"],
  tsconfigFile: "tsconfig.json",
  thresholds: {
    low: 80,
    high: 95,
    break: 90,
  },
  plugins: [
    "@stryker-mutator/vitest-runner",
    "@stryker-mutator/typescript-checker",
  ],
};
