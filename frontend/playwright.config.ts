/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3456',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'cd .. && (test -d frontend/dist/assets || (cd frontend && npm run build)) && JWT_SECRET=playwright-test-secret-32-chars-long-go EXCALIDRAW_BACKEND_HOST=localhost:3456 STORAGE_TYPE=postgres DATABASE_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-postgres://excalidraw:excalidraw@localhost:5432/excalidraw?sslmode=disable}}" /tmp/excalidraw-e2e -listen :3456 -loglevel error',
    url: 'http://localhost:3456',
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
});
