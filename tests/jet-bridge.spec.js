// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Jet Bridge Perspective tests — Tutorials & Patterns.
 *
 * The Jet Bridge connects the Terminal (getting started) to the Cockpit
 * (daily operations). It covers prompt craft, context management,
 * edit mode workflows, and agent mode patterns.
 *
 * Covers:
 *  - Page boot + core landmarks
 *  - Prompt craft (technique cards with before/after)
 *  - Context management (participants + variables)
 *  - Edit mode (workflow cards)
 *  - Agent patterns (pattern cards with risk badges)
 *  - Next steps (departure links)
 *  - Nav promotion (Jet Bridge is active, not SOON)
 */

test.describe('Jet Bridge — page structure', () => {
    test('loads without JS errors and renders core landmarks', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => {
            if (msg.type() === 'error' && !msg.text().includes('404') && !msg.text().includes('/_vercel/')) errors.push(msg.text());
        });

        await page.goto('/jet-bridge.html');
        await expect(page.locator('main#jet-bridge-main')).toBeVisible();
        await expect(page.locator('h1')).toContainText('Jet Bridge Perspective');
        expect(errors).toEqual([]);
    });

    test('marks Jet Bridge as the active nav link', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const active = page.locator('.nav-link.active');
        await expect(active).toHaveCount(1);
        await expect(active).toContainText('Jet Bridge');
    });
});

test.describe('Jet Bridge — prompt craft', () => {
    test('renders six technique cards', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const cards = page.locator('#jb-techniques .jb-technique');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(6);
    });

    test('technique cards show before/after comparison', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const first = page.locator('#jb-techniques .jb-technique').first();
        await expect(first.locator('.jb-compare-bad')).toBeVisible();
        await expect(first.locator('.jb-compare-good')).toBeVisible();
    });

    test('technique cards include a why explanation', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        await expect(page.locator('.jb-technique-why').first()).not.toBeEmpty();
    });
});

test.describe('Jet Bridge — context management', () => {
    test('renders three participant cards', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const cards = page.locator('#jb-participants .jb-context-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(3);
    });

    test('renders three variable cards', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const cards = page.locator('#jb-variables .jb-context-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(3);
    });

    test('context cards show name, description, and example', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const first = page.locator('#jb-participants .jb-context-card').first();
        await expect(first.locator('.jb-context-name')).not.toBeEmpty();
        await expect(first.locator('.jb-context-desc')).not.toBeEmpty();
        await expect(first.locator('.jb-context-example code')).not.toBeEmpty();
    });
});

test.describe('Jet Bridge — edit mode', () => {
    test('renders three workflow cards', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const cards = page.locator('#jb-workflows .jb-workflow');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(3);
    });

    test('workflow cards show steps as an ordered list', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const steps = page.locator('#jb-workflows .jb-workflow').first().locator('.jb-workflow-steps li');
        await expect(steps.first()).toBeVisible();
        const count = await steps.count();
        expect(count).toBeGreaterThanOrEqual(3);
    });

    test('workflow cards include an example', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        await expect(page.locator('.jb-workflow-example code').first()).not.toBeEmpty();
    });
});

test.describe('Jet Bridge — agent patterns', () => {
    test('renders five agent pattern cards', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const cards = page.locator('#jb-patterns .jb-pattern');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(5);
    });

    test('pattern cards show risk badges', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        await expect(page.locator('.jb-pattern-risk').first()).toBeVisible();
    });

    test('pattern cards include prompt examples', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        await expect(page.locator('.jb-pattern-example code').first()).not.toBeEmpty();
    });
});

test.describe('Jet Bridge — next steps', () => {
    test('renders five destination links', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const cards = page.locator('#jb-destinations .terminal-departure-card');
        await expect(cards.first()).toBeVisible();
        await expect(cards).toHaveCount(5);
    });

    test('destination cards link to valid perspective pages', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const first = page.locator('#jb-destinations .terminal-departure-card').first();
        await expect(first).toHaveAttribute('href', /.+\.html/);
    });
});

test.describe('Jet Bridge — nav promotion', () => {
    test('Jet Bridge nav link on the cockpit points to jet-bridge.html (no SOON)', async ({ page }) => {
        await page.goto('/');
        const jbLink = page.locator('.nav-link', { hasText: 'Jet Bridge' });
        await expect(jbLink).toHaveAttribute('href', 'jet-bridge.html');
        await expect(jbLink).not.toHaveClass(/disabled/);
        await expect(jbLink.locator('.nav-soon')).toHaveCount(0);
    });
});

test.describe('Jet Bridge — companion callout', () => {
    test('companion callout is visible with correct structure', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const callout = page.locator('.companion-callout');
        await expect(callout).toBeVisible();
        await expect(callout.locator('.companion-callout-label')).toHaveText('Companion Tool');
        await expect(callout.locator('.companion-callout-title')).toContainText('omg');
        await expect(callout.locator('.companion-callout-link')).toHaveAttribute('href', /TheTrustedAdvisor/);
    });

    test('companion callout appears before Next Steps section', async ({ page }) => {
        await page.goto('/jet-bridge.html');
        const callout = page.locator('.companion-callout');
        const nextSteps = page.locator('#next-steps-section');
        const calloutTop = await callout.boundingBox();
        const nextStepsTop = await nextSteps.boundingBox();
        expect(calloutTop.y).toBeLessThan(nextStepsTop.y);
    });
});
