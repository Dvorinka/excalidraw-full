import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3456';

// Auth: first-run signup, blocked signup, login
test.describe.serial('auth flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to signup when no users exist', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('first user can signup', async ({ page }) => {
    await page.goto(BASE + '/signup');
    await page.getByLabel('Full Name').fill('E2E User');
    await page.getByLabel('Email').fill('e2e@test.com');
    await page.getByLabel('Password').fill('e2e-password-123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(BASE + '/');
    await expect(page.getByText(/Welcome back/)).toBeVisible();
    await page.context().storageState({ path: 'playwright/.auth/state.json' });
  });

  test('blocks second signup when users exist', async ({ page }) => {
    await page.goto(BASE + '/signup');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('existing user can login', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.getByLabel('Email').fill('e2e@test.com');
    await page.getByLabel('Password').fill('e2e-password-123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(BASE + '/');
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });
});

// Dashboard: quick actions and stats
test.describe.serial('dashboard', () => {
  test.use({ storageState: 'playwright/.auth/state.json' });

  test('shows stats cards', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.getByText('Drawings')).toBeVisible();
    await expect(page.getByText('Projects')).toBeVisible();
    await expect(page.getByText('Teams')).toBeVisible();
  });

  test('quick action: New Project navigates to files', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page).toHaveURL(/\/files/);
    await expect(page.getByRole('navigation', { name: 'Project tree' })).toBeVisible();
    await expect(page.getByText('All Projects')).toBeVisible();
  });

  test('quick action: Invite navigates to team', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'Invite' }).click();
    await expect(page).toHaveURL(/\/team/);
    await expect(page.getByRole('heading', { name: 'Team Settings' })).toBeVisible();
  });

  test('New Drawing opens a blank fullscreen editor', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'New Drawing' }).click();
    await expect(page).toHaveURL(/\/drawing\//);
    await expect(page.getByRole('button', { name: /Save Now/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  });
});

// Projects / FileBrowser
test.describe.serial('projects', () => {
  test.use({ storageState: 'playwright/.auth/state.json' });

  test('shows Projects label in sidebar and breadcrumb', async ({ page }) => {
    await page.goto(BASE + '/files');
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByText('Projects')).toBeVisible();
    await expect(page.getByText('All Projects')).toBeVisible();
  });

  test('can create a drawing from file browser', async ({ page }) => {
    await page.goto(BASE + '/files');
    await page.getByRole('button', { name: 'Create new drawing' }).click();
    await expect(page).toHaveURL(/\/drawing\//);
    await expect(page.getByText('Loading Excalidraw')).toBeVisible();
  });

  test('can create a project', async ({ page }) => {
    await page.goto(BASE + '/files');
    await page.getByRole('button', { name: 'Create new project' }).click();
    await page.getByPlaceholder('Project name...').fill('Product sketches');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/files\/folder\//);
    await expect(page.getByText('Product sketches')).toBeVisible();
  });
});

// Editor / Canvas
test.describe.serial('editor', () => {
  test.use({ storageState: 'playwright/.auth/state.json' });

  test('creates drawing with To-Do template', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'New Drawing' }).click();
    await expect(page).toHaveURL(/\/drawing\//);
    await page.getByRole('button', { name: 'Toggle templates panel' }).click();
    await page.getByText('To-Do List').click();
    await expect(page.getByRole('button', { name: /Save Now/i })).toBeVisible({ timeout: 10000 });
  });

  test('editor shows save controls and back button', async ({ page }) => {
    await page.goto(BASE + '/');
    await page.getByRole('button', { name: 'New Drawing' }).click();
    await expect(page).toHaveURL(/\/drawing\//);
    await expect(page.getByRole('button', { name: /Save Now/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Back/i })).toBeVisible();
  });
});

// Team / Invites
test.describe.serial('team', () => {
  test.use({ storageState: 'playwright/.auth/state.json' });

  test('shows owner in members list', async ({ page }) => {
    await page.goto(BASE + '/team');
    await expect(page.getByRole('heading', { name: 'Team Settings' })).toBeVisible();
    await expect(page.getByText('E2E User')).toBeVisible();
    await expect(page.getByText('owner')).toBeVisible();
  });

  test('can send team invite', async ({ page }) => {
    await page.goto(BASE + '/team');
    await page.getByLabel('Email address').fill('invited@test.com');
    await page.locator('select').selectOption('editor');
    await page.getByRole('button', { name: 'Send Invite' }).click();
    await expect(page.getByText('Invite sent!')).toBeVisible();
    await expect(page.getByText('Pending Invites')).toBeVisible();
    await expect(page.getByText('invited@test.com')).toBeVisible();
    await expect(page.getByText('editor').first()).toBeVisible();
  });
});
