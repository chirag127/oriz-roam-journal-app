import { expect, test } from "@playwright/test";

test.describe("Auth-gated routes", () => {
	for (const path of [
		"/dashboard",
		"/entries",
		"/entries/new",
		"/calendar",
		"/timeline",
		"/search",
		"/stats",
		"/moods",
		"/memories",
		"/goals",
		"/templates",
		"/tags",
		"/favorites",
		"/pinned",
		"/profile",
		"/settings",
	]) {
		test(`${path} renders the sign-in notice when unauthenticated`, async ({ page }) => {
			await page.goto(path);
			await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({
				timeout: 30_000,
			});
			await expect(page.getByRole("button", { name: /^Sign in$/i }).first()).toBeVisible({
				timeout: 5_000,
			});
		});
	}

	test("404 page renders for unknown routes", async ({ page }) => {
		const res = await page.goto("/this-does-not-exist");
		expect(res?.status()).toBe(404);
		await expect(page.getByText(/404|not found/i).first()).toBeVisible();
	});

	test("offline page exists", async ({ page }) => {
		const res = await page.goto("/offline");
		expect(res?.status()).toBe(200);
	});
});
