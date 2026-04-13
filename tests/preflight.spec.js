// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Pre-Flight Checklist tests — Interactive Onboarding.
 *
 * The Pre-Flight Checklist is a cross-cutting utility page that tracks
 * onboarding readiness. Items persist in localStorage, a progress bar
 * shows overall completion, and categories link to their perspectives.
 *
 * Covers:
 *  - Page boot + core landmarks
 *  - Progress bar rendering
 *  - Category rendering with items
 *  - Checkbox interaction + localStorage persistence
 *  - Reset functionality
 *  - Nav link presence
 */

test.describe('Pre-Flight — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/preflight.html');
        await expect(page.locator('main#preflight-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Pre-Flight Checklist');
        expect(errors).toEqual([]);
    });

    test('marks Pre-Flight as the active nav link', async ({ page }) => {
        await page.goto('/preflight.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Pre-Flight');
    });
});

test.describe('Pre-Flight — progress bar', () => {
    test('progress bar renders with zero initial state', async ({ page }) => {
        await page.goto('/preflight.html');
        await expect(page.locator('#progress-section')).toBeVisible();
        await expect(page.locator('#progress-count')).not.toBeEmpty();
        await expect(page.locator('#progress-fill')).toBeAttached();
    });

    test('progress status shows "not started" initially', async ({ page }) => {
        await page.goto('/preflight.html');
        // Clear any previous state
        await page.evaluate(() => localStorage.removeItem('copilot-preflight'));
        await page.reload();
        await expect(page.locator('#progress-status')).toContainText(/not started/i);
    });
});

test.describe('Pre-Flight — categories and items', () => {
    test('renders six categories from the catalog', async ({ page }) => {
        await page.goto('/preflight.html');
        const cats = page.locator('#preflight-categories .preflight-category');
        await expect(cats.first()).toBeVisible();
        await expect(cats).toHaveCount(6);
    });

    test('categories have a "Learn more" link to their perspective', async ({ page }) => {
        await page.goto('/preflight.html');
        const link = page.locator('.preflight-category-link').first();
        await expect(link).toHaveAttribute('href', /.+\.html/);
        await expect(link).toContainText('Learn more');
    });

    test('each category shows a count badge', async ({ page }) => {
        await page.goto('/preflight.html');
        await expect(page.locator('.preflight-cat-count').first()).not.toBeEmpty();
    });

    test('checklist items render with label and detail', async ({ page }) => {
        await page.goto('/preflight.html');
        const item = page.locator('.preflight-item').first();
        await expect(item).toBeVisible();
        await expect(item.locator('.preflight-item-label')).not.toBeEmpty();
        await expect(item.locator('.preflight-item-detail')).not.toBeEmpty();
    });
});

test.describe('Pre-Flight — checkbox interaction', () => {
    test('clicking an item checks it and adds the checked class', async ({ page }) => {
        await page.goto('/preflight.html');
        await page.evaluate(() => localStorage.removeItem('copilot-preflight'));
        await page.reload();

        const item = page.locator('.preflight-item').first();
        await expect(item).not.toHaveClass(/checked/);
        await item.click();
        await expect(item).toHaveClass(/checked/);
    });

    test('checked state persists after reload via localStorage', async ({ page }) => {
        await page.goto('/preflight.html');
        await page.evaluate(() => localStorage.removeItem('copilot-preflight'));
        await page.reload();

        const item = page.locator('.preflight-item').first();
        await item.click();
        await expect(item).toHaveClass(/checked/);

        await page.reload();
        const itemAfter = page.locator('.preflight-item').first();
        await expect(itemAfter).toHaveClass(/checked/);
    });

    test('checking an item updates the progress count', async ({ page }) => {
        await page.goto('/preflight.html');
        await page.evaluate(() => localStorage.removeItem('copilot-preflight'));
        await page.reload();

        const countBefore = await page.locator('#progress-count').textContent();
        await page.locator('.preflight-item').first().click();
        const countAfter = await page.locator('#progress-count').textContent();
        expect(countBefore).not.toEqual(countAfter);
    });
});

test.describe('Pre-Flight — reset', () => {
    test('reset button clears all checked items', async ({ page }) => {
        await page.goto('/preflight.html');
        // Check a few items
        await page.locator('.preflight-item').first().click();
        await expect(page.locator('.preflight-item.checked')).toHaveCount(1);

        // Accept the confirm dialog
        page.on('dialog', (d) => d.accept());
        await page.locator('#reset-btn').click();

        await expect(page.locator('.preflight-item.checked')).toHaveCount(0);
    });
});

test.describe('Pre-Flight — nav presence', () => {
    test('Pre-Flight link appears in cockpit nav', async ({ page }) => {
        await page.goto('/');
        const link = page.locator('.nav-link', { hasText: 'Pre-Flight' });
        await expect(link).toHaveAttribute('href', 'preflight.html');
    });
});
