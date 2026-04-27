# Test info

- Name: editor >> creates drawing with To-Do template
- Location: /home/tdvorak/Desktop/PROG+HTML/Excalidraw/frontend/e2e/app.spec.ts:111:3

# Error details

```
Error: Error reading storage state from playwright/.auth/state.json:
ENOENT: no such file or directory, open 'playwright/.auth/state.json'
```

# Test source

```ts
   11 |     await expect(page).toHaveURL(/\/signup$/);
   12 |     await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
   13 |   });
   14 |
   15 |   test('first user can signup', async ({ page }) => {
   16 |     await page.goto(BASE + '/signup');
   17 |     await page.getByLabel('Full Name').fill('E2E User');
   18 |     await page.getByLabel('Email').fill('e2e@test.com');
   19 |     await page.getByLabel('Password').fill('e2e-password-123');
   20 |     await page.getByRole('button', { name: 'Create Account' }).click();
   21 |     await expect(page).toHaveURL(BASE + '/');
   22 |     await expect(page.getByText(/Welcome back/)).toBeVisible();
   23 |     await page.context().storageState({ path: 'playwright/.auth/state.json' });
   24 |   });
   25 |
   26 |   test('blocks second signup when users exist', async ({ page }) => {
   27 |     await page.goto(BASE + '/signup');
   28 |     await expect(page).toHaveURL(/\/login$/);
   29 |   });
   30 |
   31 |   test('existing user can login', async ({ page }) => {
   32 |     await page.goto(BASE + '/login');
   33 |     await page.getByLabel('Email').fill('e2e@test.com');
   34 |     await page.getByLabel('Password').fill('e2e-password-123');
   35 |     await page.getByRole('button', { name: 'Sign In' }).click();
   36 |     await expect(page).toHaveURL(BASE + '/');
   37 |     await expect(page.getByText(/Welcome back/)).toBeVisible();
   38 |   });
   39 | });
   40 |
   41 | // Dashboard: quick actions and stats
   42 | test.describe.serial('dashboard', () => {
   43 |   test.use({ storageState: 'playwright/.auth/state.json' });
   44 |
   45 |   test('shows stats cards', async ({ page }) => {
   46 |     await page.goto(BASE + '/');
   47 |     await expect(page.getByText('Drawings')).toBeVisible();
   48 |     await expect(page.getByText('Projects')).toBeVisible();
   49 |     await expect(page.getByText('Teams')).toBeVisible();
   50 |   });
   51 |
   52 |   test('quick action: New Project navigates to files', async ({ page }) => {
   53 |     await page.goto(BASE + '/');
   54 |     await page.getByRole('button', { name: 'New Project' }).click();
   55 |     await expect(page).toHaveURL(/\/files/);
   56 |     await expect(page.getByRole('navigation', { name: 'Project tree' })).toBeVisible();
   57 |     await expect(page.getByText('All Projects')).toBeVisible();
   58 |   });
   59 |
   60 |   test('quick action: Invite navigates to team', async ({ page }) => {
   61 |     await page.goto(BASE + '/');
   62 |     await page.getByRole('button', { name: 'Invite' }).click();
   63 |     await expect(page).toHaveURL(/\/team/);
   64 |     await expect(page.getByRole('heading', { name: 'Team Settings' })).toBeVisible();
   65 |   });
   66 |
   67 |   test('quick action: Library navigates to marketplace', async ({ page }) => {
   68 |     await page.goto(BASE + '/');
   69 |     await page.getByRole('button', { name: 'Library' }).click();
   70 |     await expect(page).toHaveURL(/\/library/);
   71 |     await expect(page.getByRole('heading', { name: 'Library Marketplace' })).toBeVisible();
   72 |   });
   73 |
   74 |   test('New Drawing opens template picker', async ({ page }) => {
   75 |     await page.goto(BASE + '/');
   76 |     await page.getByRole('button', { name: 'New Drawing' }).click();
   77 |     await expect(page.getByRole('dialog')).toBeVisible();
   78 |     await expect(page.getByRole('heading', { name: 'Choose a Template' })).toBeVisible();
   79 |     await expect(page.getByRole('button', { name: 'Blank Canvas' })).toBeVisible();
   80 |     await expect(page.getByRole('button', { name: 'To-Do List' })).toBeVisible();
   81 |     await expect(page.getByRole('button', { name: 'Checklist' })).toBeVisible();
   82 |     await expect(page.getByRole('button', { name: 'Bullet List' })).toBeVisible();
   83 |     await expect(page.getByRole('button', { name: 'Flow Chart' })).toBeVisible();
   84 |   });
   85 | });
   86 |
   87 | // Projects / FileBrowser
   88 | test.describe.serial('projects', () => {
   89 |   test.use({ storageState: 'playwright/.auth/state.json' });
   90 |
   91 |   test('shows Projects label in sidebar and breadcrumb', async ({ page }) => {
   92 |     await page.goto(BASE + '/files');
   93 |     await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByText('Projects')).toBeVisible();
   94 |     await expect(page.getByText('All Projects')).toBeVisible();
   95 |   });
   96 |
   97 |   test('can create a drawing from file browser', async ({ page }) => {
   98 |     await page.goto(BASE + '/files');
   99 |     await page.getByRole('button', { name: 'Create new drawing' }).click();
  100 |     await expect(page.getByRole('dialog')).toBeVisible();
  101 |     await page.getByRole('button', { name: 'Blank Canvas' }).click();
  102 |     await expect(page).toHaveURL(/\/drawing\//);
  103 |     await expect(page.getByText('Loading Excalidraw')).toBeVisible();
  104 |   });
  105 | });
  106 |
  107 | // Editor / Canvas
  108 | test.describe.serial('editor', () => {
  109 |   test.use({ storageState: 'playwright/.auth/state.json' });
  110 |
> 111 |   test('creates drawing with To-Do template', async ({ page }) => {
      |   ^ Error: Error reading storage state from playwright/.auth/state.json:
  112 |     await page.goto(BASE + '/');
  113 |     await page.getByRole('button', { name: 'New Drawing' }).click();
  114 |     await page.getByRole('button', { name: 'To-Do List' }).click();
  115 |     await expect(page).toHaveURL(/\/drawing\//);
  116 |     await expect(page.getByRole('button', { name: /Save Now/i })).toBeVisible({ timeout: 10000 });
  117 |   });
  118 |
  119 |   test('editor shows save controls and back button', async ({ page }) => {
  120 |     await page.goto(BASE + '/');
  121 |     await page.getByRole('button', { name: 'New Drawing' }).click();
  122 |     await page.getByRole('button', { name: 'Blank Canvas' }).click();
  123 |     await expect(page).toHaveURL(/\/drawing\//);
  124 |     await expect(page.getByRole('button', { name: /Save Now/i })).toBeVisible({ timeout: 10000 });
  125 |     await expect(page.getByRole('button', { name: /Back/i })).toBeVisible();
  126 |   });
  127 | });
  128 |
  129 | // Library Marketplace
  130 | test.describe.serial('library', () => {
  131 |   test.use({ storageState: 'playwright/.auth/state.json' });
  132 |
  133 |   test('loads marketplace with search and categories', async ({ page }) => {
  134 |     await page.goto(BASE + '/library');
  135 |     await expect(page.getByRole('heading', { name: 'Library Marketplace' })).toBeVisible();
  136 |     await expect(page.getByPlaceholder('Search libraries...')).toBeVisible();
  137 |     await expect(page.getByRole('button', { name: 'All' }).first()).toBeVisible();
  138 |     await expect(page.getByRole('button', { name: 'Open External' })).toBeVisible();
  139 |   });
  140 |
  141 |   test('search filters libraries', async ({ page }) => {
  142 |     await page.goto(BASE + '/library');
  143 |     await page.getByPlaceholder('Search libraries...').fill('zzzznonexistent');
  144 |     await expect(page.getByText('No libraries found')).toBeVisible();
  145 |   });
  146 | });
  147 |
  148 | // Team / Invites
  149 | test.describe.serial('team', () => {
  150 |   test.use({ storageState: 'playwright/.auth/state.json' });
  151 |
  152 |   test('shows owner in members list', async ({ page }) => {
  153 |     await page.goto(BASE + '/team');
  154 |     await expect(page.getByRole('heading', { name: 'Team Settings' })).toBeVisible();
  155 |     await expect(page.getByText('E2E User')).toBeVisible();
  156 |     await expect(page.getByText('owner')).toBeVisible();
  157 |   });
  158 |
  159 |   test('can send team invite', async ({ page }) => {
  160 |     await page.goto(BASE + '/team');
  161 |     await page.getByLabel('Email address').fill('invited@test.com');
  162 |     await page.locator('select').selectOption('editor');
  163 |     await page.getByRole('button', { name: 'Send Invite' }).click();
  164 |     await expect(page.getByText('Invite sent!')).toBeVisible();
  165 |     await expect(page.getByText('Pending Invites')).toBeVisible();
  166 |     await expect(page.getByText('invited@test.com')).toBeVisible();
  167 |     await expect(page.getByText('editor').first()).toBeVisible();
  168 |   });
  169 | });
  170 |
```