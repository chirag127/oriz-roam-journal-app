import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
	test("renders hero, value props, and CTAs", async ({ page }) => {
		const consoleErrors: string[] = [];
		page.on("pageerror", (err) => consoleErrors.push(err.message));
		page.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});

		const response = await page.goto("/");
		expect(response?.status()).toBe(200);
		expect(response?.headers()["content-type"]).toContain("text/html");

		await expect(page).toHaveTitle(/Journal/);
		await expect(page.getByRole("heading", { level: 1 })).toContainText(
			/A quiet place|for the thoughts/i,
		);
		await expect(page.getByRole("link", { name: /Start writing/i }).first()).toBeVisible();
		await expect(page.getByRole("link", { name: /I have an account/i })).toBeVisible();

		await expect(page.getByText(/Write daily, friction-free/)).toBeVisible();
		await expect(page.getByText(/See your life, not just your day/)).toBeVisible();
		await expect(page.getByText(/Your words, your file/)).toBeVisible();

		const filtered = consoleErrors.filter(
			(e) =>
				!e.includes("favicon") &&
				!e.includes("manifest") &&
				!e.toLowerCase().includes("preload") &&
				!e.toLowerCase().includes("404") &&
				!e.toLowerCase().includes("workbox"),
		);
		expect(filtered, `unexpected console errors: ${filtered.join("\n")}`).toEqual([]);
	});

	test("theme bootstraps from localStorage", async ({ page, context }) => {
		await context.addInitScript(() => {
			localStorage.setItem(
				"journal.theme",
				JSON.stringify({ state: { theme: "dark" }, version: 0 }),
			);
		});
		await page.goto("/");
		const theme = await page.locator("html").getAttribute("data-theme");
		expect(theme).toBe("dark");
	});

	test("respects prefers-color-scheme when theme is system", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await page.goto("/");
		const theme = await page.locator("html").getAttribute("data-theme");
		expect(["dark", "system"]).toContain(theme);
		if (theme !== "system") {
			expect(theme).toBe("dark");
		}
	});
});
