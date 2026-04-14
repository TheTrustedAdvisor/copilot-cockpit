// @ts-check
const { test, expect } = require('@playwright/test');

// ============================================================
// FLIGHT LOG — PAGE LOAD
// ============================================================

test.describe('Flight Log - Page Load', () => {
    test('loads without console errors', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error' && !msg.text().includes('404') && !msg.text().includes('/_vercel/')) errors.push(msg.text());
        });

        await page.goto('/flight-log.html');
        await expect(page.locator('.flight-log-timeline')).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('renders changelog entries from JSON', async ({ page }) => {
        await page.goto('/flight-log.html');
        const entries = page.locator('.log-entry');
        await expect(entries.first()).toBeVisible();

        const count = await entries.count();
        expect(count).toBeGreaterThan(10);
    });

    test('groups entries by year', async ({ page }) => {
        await page.goto('/flight-log.html');
        const yearHeaders = page.locator('.log-year-header');
        await expect(yearHeaders.first()).toBeVisible();

        const count = await yearHeaders.count();
        expect(count).toBeGreaterThanOrEqual(3); // We have entries from 2022-2026
    });

    test('shows stats bar with entry counts', async ({ page }) => {
        await page.goto('/flight-log.html');
        const stats = page.locator('.flight-log-stats');
        await expect(stats).toBeVisible();
        await expect(stats).not.toBeEmpty();
    });
});

// ============================================================
// FLIGHT LOG — FILTERS
// ============================================================

test.describe('Flight Log - Filters', () => {
    test('filters by entry type', async ({ page }) => {
        await page.goto('/flight-log.html');
        const totalBefore = await page.locator('.log-entry').count();

        // Click "Departure" filter
        await page.locator('.log-filter[data-filter-value="departure"]').click();

        const filteredCount = await page.locator('.log-entry').count();
        expect(filteredCount).toBeGreaterThan(0);
        expect(filteredCount).toBeLessThan(totalBefore);

        // All visible entries should be departures
        const entries = page.locator('.log-entry');
        for (let i = 0; i < await entries.count(); i++) {
            const type = await entries.nth(i).getAttribute('data-type');
            expect(type).toBe('departure');
        }
    });

    test('filters by zone', async ({ page }) => {
        await page.goto('/flight-log.html');
        const totalBefore = await page.locator('.log-entry').count();

        await page.locator('.log-filter[data-filter-value="pfd"]').click();

        const filteredCount = await page.locator('.log-entry').count();
        expect(filteredCount).toBeGreaterThan(0);
        expect(filteredCount).toBeLessThan(totalBefore);

        // All visible entries should be PFD zone
        const entries = page.locator('.log-entry');
        for (let i = 0; i < await entries.count(); i++) {
            const zone = await entries.nth(i).getAttribute('data-zone');
            expect(zone).toBe('pfd');
        }
    });

    test('toggling filter off restores all entries', async ({ page }) => {
        await page.goto('/flight-log.html');
        const totalBefore = await page.locator('.log-entry').count();

        // Activate then deactivate
        await page.locator('.log-filter[data-filter-value="departure"]').click();
        await page.locator('.log-filter[data-filter-value="departure"]').click();

        const totalAfter = await page.locator('.log-entry').count();
        expect(totalAfter).toBe(totalBefore);
    });

    test('combines type and zone filters', async ({ page }) => {
        await page.goto('/flight-log.html');

        // Filter by departure AND pfd
        await page.locator('.log-filter[data-filter-value="departure"]').click();
        await page.locator('.log-filter[data-filter-value="pfd"]').click();

        const entries = page.locator('.log-entry');
        const count = await entries.count();
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            expect(await entries.nth(i).getAttribute('data-type')).toBe('departure');
            expect(await entries.nth(i).getAttribute('data-zone')).toBe('pfd');
        }
    });
});

// ============================================================
// FLIGHT LOG — ENTRY CONTENT
// ============================================================

test.describe('Flight Log - Entry Content', () => {
    test('entries have type badge, title, and description', async ({ page }) => {
        await page.goto('/flight-log.html');
        const firstEntry = page.locator('.log-entry').first();

        await expect(firstEntry.locator('.log-entry-type')).toBeVisible();
        await expect(firstEntry.locator('.log-entry-title')).not.toBeEmpty();
        await expect(firstEntry.locator('.log-entry-description')).not.toBeEmpty();
    });

    test('entries have instrument links', async ({ page }) => {
        await page.goto('/flight-log.html');
        const links = page.locator('.log-instrument-link');
        await expect(links.first()).toBeVisible();

        // Links should point to cockpit instrument deep links
        const href = await links.first().getAttribute('href');
        expect(href).toContain('index.html#instrument-');
    });
});

// ============================================================
// FLIGHT LOG — NAVIGATION
// ============================================================

test.describe('Flight Log - Navigation', () => {
    test('has navigation bar with Cockpit and Flight Log links', async ({ page }) => {
        await page.goto('/flight-log.html');
        const nav = page.locator('.header-nav');
        await expect(nav).toBeVisible();

        await expect(nav.locator('a', { hasText: 'Cockpit' })).toBeVisible();
        await expect(nav.locator('a', { hasText: 'Flight Log' })).toHaveClass(/active/);
    });

    test('Cockpit page has Flight Log nav link', async ({ page }) => {
        await page.goto('/');
        const nav = page.locator('.header-nav');
        await expect(nav).toBeVisible();

        await expect(nav.locator('a', { hasText: 'Cockpit' })).toHaveClass(/active/);
        await expect(nav.locator('a', { hasText: 'Flight Log' })).toBeVisible();
    });

    test('navigating from Flight Log to Cockpit works', async ({ page }) => {
        await page.goto('/flight-log.html');
        await page.locator('.nav-link', { hasText: 'Cockpit' }).click();
        await expect(page.locator('.cockpit-grid')).toBeVisible();
    });
});

// ============================================================
// FLIGHT LOG — THEME
// ============================================================

test.describe('Flight Log - Theme', () => {
    test('theme toggle works on Flight Log page', async ({ page }) => {
        await page.goto('/flight-log.html');
        await expect(page.locator('body')).not.toHaveClass(/light-theme/);

        await page.locator('#theme-toggle').click();
        await expect(page.locator('body')).toHaveClass(/light-theme/);
    });

    test('theme persists between Cockpit and Flight Log', async ({ page }) => {
        // Set light theme on cockpit
        await page.goto('/');
        await page.locator('#theme-toggle').click();
        await expect(page.locator('body')).toHaveClass(/light-theme/);

        // Navigate to flight log — should still be light
        await page.goto('/flight-log.html');
        await expect(page.locator('body')).toHaveClass(/light-theme/);
    });
});
