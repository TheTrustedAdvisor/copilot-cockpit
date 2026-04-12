// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Ramp Perspective tests — Agents & Ground Handling.
 *
 * The Ramp is perspective #4 in the airport journey: the apron where
 * autonomous agents, MCP tool servers, and background infrastructure
 * operate without the pilot's hands on the controls.
 *
 * Covers:
 *  - Page boot + core landmarks
 *  - Instrument cards render from copilot-instruments.json (ramp filter)
 *  - Detail blade opens on card click and on deep link
 *  - Blade closes on Esc / backdrop / ✕
 *  - Metaphor key renders
 *  - Nav promotion (Ramp is active, not SOON)
 */

test.describe('Ramp — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await page.goto('/ramp.html');
        await expect(page.locator('main#ramp-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Ramp Perspective');
        expect(errors).toEqual([]);
    });

    test('marks Ramp as the active nav link', async ({ page }) => {
        await page.goto('/ramp.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Ramp');
    });
});

test.describe('Ramp — instrument cards', () => {
    test('renders one card per ramp-perspective instrument', async ({ page }) => {
        await page.goto('/ramp.html');
        const cards = page.locator('#ramp-grid .ramp-card');
        await expect(cards.first()).toBeVisible();
        // coding-agent, mcp, agent-self-review, copilot-extensions
        await expect(cards).toHaveCount(4);
    });

    test('cards show symbol, name, and status', async ({ page }) => {
        await page.goto('/ramp.html');
        const card = page.locator('#ramp-grid .ramp-card').first();
        await expect(card.locator('.ramp-card-symbol')).not.toBeEmpty();
        await expect(card.locator('.ramp-card-name')).not.toBeEmpty();
        await expect(card.locator('.ramp-card-status')).not.toBeEmpty();
    });

    test('cards carry their instrument id for deep linking', async ({ page }) => {
        await page.goto('/ramp.html');
        const card = page.locator('#ramp-grid .ramp-card').first();
        await expect(card).toHaveAttribute('data-instrument-id', /.+/);
    });
});

test.describe('Ramp — detail blade', () => {
    test('blade is hidden by default', async ({ page }) => {
        await page.goto('/ramp.html');
        await expect(page.locator('#ramp-blade')).not.toHaveClass(/open/);
    });

    test('clicking a card opens the blade with instrument details', async ({ page }) => {
        await page.goto('/ramp.html');
        const firstCard = page.locator('#ramp-grid .ramp-card').first();
        const instId = await firstCard.getAttribute('data-instrument-id');
        await firstCard.click();

        const blade = page.locator('#ramp-blade');
        await expect(blade).toHaveClass(/open/);
        await expect(blade.locator('#ramp-blade-title')).not.toHaveText('—');

        // URL hash updates
        expect(page.url()).toContain(`#instrument-${instId}`);
    });

    test('blade renders capabilities', async ({ page }) => {
        await page.goto('/ramp.html');
        await page.locator('#ramp-grid .ramp-card').first().click();
        await expect(page.locator('#ramp-blade-body .blade-cap-pill').first()).toBeVisible();
    });

    test('blade closes on ✕ click', async ({ page }) => {
        await page.goto('/ramp.html');
        await page.locator('#ramp-grid .ramp-card').first().click();
        await expect(page.locator('#ramp-blade')).toHaveClass(/open/);
        await page.locator('#ramp-blade-close').click();
        await expect(page.locator('#ramp-blade')).not.toHaveClass(/open/);
    });

    test('blade closes on Escape key', async ({ page }) => {
        await page.goto('/ramp.html');
        await page.locator('#ramp-grid .ramp-card').first().click();
        await expect(page.locator('#ramp-blade')).toHaveClass(/open/);
        await page.keyboard.press('Escape');
        await expect(page.locator('#ramp-blade')).not.toHaveClass(/open/);
    });

    test('blade closes on backdrop click', async ({ page }) => {
        await page.goto('/ramp.html');
        await page.locator('#ramp-grid .ramp-card').first().click();
        await expect(page.locator('#ramp-blade')).toHaveClass(/open/);
        await page.locator('#ramp-blade-backdrop').click();
        await expect(page.locator('#ramp-blade')).not.toHaveClass(/open/);
    });

    test('deep link #instrument-<id> opens the blade on load', async ({ page }) => {
        await page.goto('/ramp.html#instrument-mcp');
        await expect(page.locator('#ramp-blade')).toHaveClass(/open/);
        await expect(page.locator('#ramp-blade-title')).toContainText('MCP');
    });
});

test.describe('Ramp — metaphor key', () => {
    test('metaphor key renders aviation-to-Copilot mappings', async ({ page }) => {
        await page.goto('/ramp.html');
        const items = page.locator('.ramp-metaphor-item');
        await expect(items.first()).toBeVisible();
        // 5 mappings: Baggage, Fuel, Catering, Safety Inspector, Pushback
        await expect(items).toHaveCount(5);
    });
});

test.describe('Ramp — nav promotion', () => {
    test('Ramp nav link on the cockpit points to ramp.html (no SOON)', async ({ page }) => {
        await page.goto('/');
        const rampLink = page.locator('.header-nav a[href="ramp.html"]');
        await expect(rampLink).toHaveCount(1);
        await expect(rampLink).not.toHaveClass(/disabled/);
        await expect(rampLink.locator('.nav-soon')).toHaveCount(0);
    });

    test('navigation from cockpit to ramp works', async ({ page }) => {
        await page.goto('/');
        await page.locator('.header-nav a[href="ramp.html"]').click();
        await expect(page).toHaveURL(/ramp\.html/);
        await expect(page.locator('main#ramp-main')).toBeVisible();
    });
});
