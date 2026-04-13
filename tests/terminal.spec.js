// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Terminal Perspective tests — Getting Started.
 *
 * The Terminal is the airport entry point: plan selection (check-in),
 * IDE setup (boarding pass), first Copilot interaction (first flight),
 * and navigation to other perspectives (departure board).
 *
 * Covers:
 *  - Page boot + core landmarks
 *  - Check-in desk (plan cards)
 *  - Boarding pass (IDE setup cards)
 *  - First flight (exercise cards)
 *  - Departure board (links to other perspectives)
 *  - Nav promotion (Terminal is active, not SOON)
 */

test.describe('Terminal — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/terminal.html');
        await expect(page.locator('main#terminal-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Terminal Perspective');
        expect(errors).toEqual([]);
    });

    test('marks Terminal as the active nav link', async ({ page }) => {
        await page.goto('/terminal.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Terminal');
    });
});

test.describe('Terminal — check-in desk (plan selection)', () => {
    test('renders five plan cards from the catalog', async ({ page }) => {
        await page.goto('/terminal.html');
        const cards = page.locator('#terminal-plans .terminal-plan-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(5);
    });

    test('plan cards show name and price', async ({ page }) => {
        await page.goto('/terminal.html');
        const first = page.locator('#terminal-plans .terminal-plan-card').first();
        await expect(first.locator('.terminal-plan-name')).not.toBeEmpty();
        await expect(first.locator('.terminal-plan-price')).not.toBeEmpty();
    });

    test('plan cards show highlights and limitations', async ({ page }) => {
        await page.goto('/terminal.html');
        const first = page.locator('#terminal-plans .terminal-plan-card').first();
        await expect(first.locator('.terminal-highlight').first()).toBeVisible();
        await expect(first.locator('.terminal-limitation').first()).toBeVisible();
    });

    test('check-in intro text is populated', async ({ page }) => {
        await page.goto('/terminal.html');
        await expect(page.locator('#checkin-intro')).not.toBeEmpty();
    });
});

test.describe('Terminal — boarding pass (IDE setup)', () => {
    test('renders six IDE cards from the catalog', async ({ page }) => {
        await page.goto('/terminal.html');
        const cards = page.locator('#terminal-ides .terminal-ide-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(6);
    });

    test('IDE cards show name and status', async ({ page }) => {
        await page.goto('/terminal.html');
        const first = page.locator('#terminal-ides .terminal-ide-card').first();
        await expect(first.locator('.terminal-ide-name')).not.toBeEmpty();
        await expect(first.locator('.terminal-ide-status')).not.toBeEmpty();
    });

    test('IDE cards show surface pills', async ({ page }) => {
        await page.goto('/terminal.html');
        await expect(page.locator('.terminal-surface-pill').first()).toBeVisible();
    });

    test('IDE cards show setup steps as an ordered list', async ({ page }) => {
        await page.goto('/terminal.html');
        const steps = page.locator('#terminal-ides .terminal-ide-card').first().locator('.terminal-ide-steps li');
        await expect(steps.first()).toBeVisible();
        const count = await steps.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });
});

test.describe('Terminal — first flight (exercises)', () => {
    test('renders three exercise cards', async ({ page }) => {
        await page.goto('/terminal.html');
        const cards = page.locator('#terminal-exercises .terminal-exercise');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(3);
    });

    test('exercise cards show title and surface badge', async ({ page }) => {
        await page.goto('/terminal.html');
        const first = page.locator('#terminal-exercises .terminal-exercise').first();
        await expect(first.locator('.terminal-exercise-title')).not.toBeEmpty();
        await expect(first.locator('.terminal-exercise-surface')).not.toBeEmpty();
    });

    test('exercise cards contain code examples', async ({ page }) => {
        await page.goto('/terminal.html');
        await expect(page.locator('.terminal-exercise-code code').first()).not.toBeEmpty();
    });
});

test.describe('Terminal — departure board', () => {
    test('renders five departure links', async ({ page }) => {
        await page.goto('/terminal.html');
        const cards = page.locator('#terminal-departures .terminal-departure-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(5);
    });

    test('departure cards link to valid perspective pages', async ({ page }) => {
        await page.goto('/terminal.html');
        const first = page.locator('#terminal-departures .terminal-departure-card').first();
        await expect(first).toHaveAttribute('href', /.+\.html/);
    });

    test('departure cards show perspective name and reason', async ({ page }) => {
        await page.goto('/terminal.html');
        const first = page.locator('#terminal-departures .terminal-departure-card').first();
        await expect(first.locator('.terminal-departure-perspective')).not.toBeEmpty();
        await expect(first.locator('.terminal-departure-reason')).not.toBeEmpty();
    });
});

test.describe('Terminal — nav promotion', () => {
    test('Terminal nav link on the cockpit points to terminal.html (no SOON)', async ({ page }) => {
        await page.goto('/');
        const terminalLink = page.locator('.nav-link', { hasText: 'Terminal' });
        await expect(terminalLink).toHaveAttribute('href', 'terminal.html');
        await expect(terminalLink).not.toHaveClass(/disabled/);
        await expect(terminalLink.locator('.nav-soon')).toHaveCount(0);
    });
});
