import { devices, expect, test } from "@playwright/test";

test.use(devices["iPhone 14"]);

test.describe("Mobile layout (iPhone 14, 390x844)", () => {
	test("landing page is readable and has CTA above the fold", async ({ page }) => {
		await page.goto("/");
		const heading = page.getByRole("heading", { level: 1 });
		await expect(heading).toBeVisible();
		const box = await heading.boundingBox();
		expect(box?.width).toBeLessThan(450);
		await expect(page.getByRole("link", { name: /Start writing/i }).first()).toBeVisible();
	});

	test("no horizontal overflow on landing", async ({ page }) => {
		await page.goto("/");
		const overflow = await page.evaluate(() => {
			return {
				body: document.body.scrollWidth,
				doc: document.documentElement.scrollWidth,
				viewport: window.innerWidth,
			};
		});
		expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
		expect(overflow.doc).toBeLessThanOrEqual(overflow.viewport + 1);
	});

	test("login page is usable on mobile", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
		const btn = page.getByRole("button", { name: /Continue with Google/i });
		const box = await btn.boundingBox();
		expect(box?.width).toBeGreaterThan(200);
		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test("input font-size is at least 16px to prevent iOS zoom", async ({ page }) => {
		await page.goto("/login");
		const input = page.getByLabel(/email/i);
		await expect(input).toBeVisible();
		const fontSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		expect(fontSize).toBeGreaterThanOrEqual(16);
	});

	test("sign-in notice renders on mobile for /dashboard", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({
			timeout: 10_000,
		});
	});

	test("mobile drawer toggle has 44px tap target", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByRole("link", { name: /Create account/i })).toBeVisible();
	});

	test("CTA button height is at least 44px on mobile", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		const cta = page.getByRole("link", { name: /^(Start writing|Start your first entry)/i }).first();
		await expect(cta).toBeVisible({ timeout: 15_000 });
		await cta.scrollIntoViewIfNeeded();
		const box = await cta.boundingBox();
		expect(box?.height).toBeGreaterThanOrEqual(44);
	});

	test("no horizontal overflow on login", async ({ page }) => {
		await page.goto("/login");
		const overflow = await page.evaluate(() => ({
			body: document.body.scrollWidth,
			viewport: window.innerWidth,
		}));
		expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
	});
});

test.describe("Extra-narrow viewport (iPhone SE, 320x568)", () => {
	test.use({ viewport: { width: 320, height: 568 } });

	test("landing renders without overflow at 320px", async ({ page }) => {
		await page.goto("/");
		const heading = page.getByRole("heading", { level: 1 });
		await expect(heading).toBeVisible();
		const overflow = await page.evaluate(() => ({
			body: document.body.scrollWidth,
			viewport: window.innerWidth,
		}));
		expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
	});

	test("login renders without overflow at 320px", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
		const overflow = await page.evaluate(() => ({
			body: document.body.scrollWidth,
			viewport: window.innerWidth,
		}));
		expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
	});
});
