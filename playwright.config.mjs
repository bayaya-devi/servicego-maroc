import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SERVICEGO_E2E_URL || "https://servicego-maroc-staging.aetbconseil.workers.dev";
const retainArtifacts = process.env.PLAYWRIGHT_ARTIFACTS !== "off";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
    screenshot: retainArtifacts ? "only-on-failure" : "off",
    trace: retainArtifacts ? "retain-on-failure" : "off",
    video: retainArtifacts ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-android-small", use: { ...devices["Galaxy S8"] } },
    { name: "chromium-android-standard", use: { ...devices["Pixel 7"] } },
    { name: "chromium-iphone", use: { ...devices["iPhone 13"] } },
    { name: "chromium-large-phone", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] } },
  ],
});
