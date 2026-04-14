// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Wiring Diagram tests — Instrument Connection Graph.
 *
 * The Wiring Diagram shows how Copilot's instruments connect to each
 * other — context flows, governance controls, and integration points.
 * Features: Mermaid graph, filter buttons, legend, zone map, and stats.
 *
 * Covers:
 *  - Page boot + core landmarks
 *  - Mermaid diagram renders as SVG
 *  - Filter buttons render
 *  - Connection legend
 *  - Zone map
 *  - Stats section
 *  - Nav link presence
 */

test.describe('Wiring — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error' && !msg.text().includes('404') && !msg.text().includes('/_vercel/')) errors.push(msg.text());
        });

        await page.goto('/wiring.html');
        await expect(page.locator('main#wiring-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Wiring Diagram');
        expect(errors).toEqual([]);
    });

    test('marks Wiring as the active nav link', async ({ page }) => {
        await page.goto('/wiring.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Wiring');
    });
});

test.describe('Wiring — Mermaid diagram', () => {
    test('Mermaid diagram renders as SVG', async ({ page }) => {
        await page.goto('/wiring.html');
        await expect(page.locator('#wiring-diagram svg').first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Wiring — filters', () => {
    test('renders five filter buttons (All + 4 types)', async ({ page }) => {
        await page.goto('/wiring.html');
        const btns = page.locator('#wiring-filters .wiring-filter-btn');
        await expect(btns.first()).toBeVisible();
        await expect(btns).toHaveCount(5);
    });

    test('All filter is active by default', async ({ page }) => {
        await page.goto('/wiring.html');
        const allBtn = page.locator('#wiring-filters .wiring-filter-btn').first();
        await expect(allBtn).toHaveClass(/active/);
        await expect(allBtn).toContainText('All');
    });

    test('clicking a filter re-renders the diagram', async ({ page }) => {
        await page.goto('/wiring.html');
        await expect(page.locator('#wiring-diagram svg').first()).toBeVisible({ timeout: 10000 });
        // Click the second filter (first connection type)
        const filterBtn = page.locator('#wiring-filters .wiring-filter-btn').nth(1);
        await filterBtn.click();
        await expect(filterBtn).toHaveClass(/active/);
        // Diagram should still render
        await expect(page.locator('#wiring-diagram svg').first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Wiring — legend', () => {
    test('renders four connection type legend items', async ({ page }) => {
        await page.goto('/wiring.html');
        const items = page.locator('#wiring-legend .wiring-legend-item');
        await expect(items.first()).toBeVisible();
        await expect(items).toHaveCount(4);
    });

    test('legend items show label and description', async ({ page }) => {
        await page.goto('/wiring.html');
        const first = page.locator('#wiring-legend .wiring-legend-item').first();
        await expect(first.locator('.wiring-legend-label')).not.toBeEmpty();
        await expect(first.locator('.wiring-legend-desc')).not.toBeEmpty();
    });
});

test.describe('Wiring — zone map', () => {
    test('renders eight zone cards', async ({ page }) => {
        await page.goto('/wiring.html');
        const cards = page.locator('#wiring-zones .wiring-zone-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(8);
    });

    test('zone cards show label, name, and count', async ({ page }) => {
        await page.goto('/wiring.html');
        const first = page.locator('#wiring-zones .wiring-zone-card').first();
        await expect(first.locator('.wiring-zone-label')).not.toBeEmpty();
        await expect(first.locator('.wiring-zone-name')).not.toBeEmpty();
        await expect(first.locator('.wiring-zone-count')).not.toBeEmpty();
    });
});

test.describe('Wiring — stats', () => {
    test('renders four stat cards', async ({ page }) => {
        await page.goto('/wiring.html');
        const stats = page.locator('#wiring-stats .wiring-stat');
        await expect(stats.first()).toBeVisible();
        await expect(stats).toHaveCount(4);
    });

    test('type breakdown shows four rows', async ({ page }) => {
        await page.goto('/wiring.html');
        const rows = page.locator('.wiring-type-breakdown .wiring-type-row');
        await expect(rows.first()).toBeVisible();
        await expect(rows).toHaveCount(4);
    });

    test('most connected shows top 5 instruments', async ({ page }) => {
        await page.goto('/wiring.html');
        const rows = page.locator('.wiring-top-nodes .wiring-type-row');
        await expect(rows.first()).toBeVisible();
        await expect(rows).toHaveCount(5);
    });
});

test.describe('Wiring — nav presence', () => {
    test('Wiring link appears in cockpit nav', async ({ page }) => {
        await page.goto('/');
        const link = page.locator('.nav-link', { hasText: 'Wiring' });
        await expect(link).toHaveAttribute('href', 'wiring.html');
    });
});
