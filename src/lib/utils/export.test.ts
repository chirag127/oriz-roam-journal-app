import { describe, it, expect, vi } from "vitest";
import { exportEntry, exportAll, downloadBlob } from "@/lib/utils/export";
import type { JournalEntry } from "@/types/journal";

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
	return {
		id: "entry-1",
		userId: "user-1",
		title: "My Day",
		content: "Today was great.\n\nI went for a walk.",
		mood: "good",
		moodIntensity: 4,
		tags: ["daily", "reflection"],
		location: { lat: 12.34, lng: 56.78, label: "Central Park" },
		weather: { temp: 22, condition: "sunny" },
		journalType: "daily",
		entryDate: "2025-06-15",
		createdAt: "2025-06-15T10:00:00Z",
		updatedAt: "2025-06-15T12:00:00Z",
		favorite: true,
		pinned: false,
		wordCount: 8,
		readingTime: 0.5,
		isDraft: false,
		...overrides,
	};
}

async function blobText(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsText(blob);
	});
}

describe("exportEntry", () => {
	it("exports as markdown with frontmatter and body", async () => {
		const result = exportEntry(makeEntry(), "markdown");
		expect(result.filename).toBe("2025-06-15-My-Day.md");
		expect(result.mime).toBe("text/markdown");
		expect(result.blob).toBeInstanceOf(Blob);
		const text = await blobText(result.blob);
		expect(text).toContain("---");
		expect(text).toContain("journalType: daily");
		expect(text).toContain("# My Day");
		expect(text).toContain("Today was great");
	});

	it("exports as text with date header", async () => {
		const result = exportEntry(makeEntry(), "text");
		expect(result.filename).toBe("2025-06-15-My-Day.txt");
		expect(result.mime).toBe("text/plain");
		const text = await blobText(result.blob);
		expect(text).toContain("My Day");
		expect(text).toContain("Sunday, June 15, 2025");
	});

	it("exports as json preserves entry fields", async () => {
		const result = exportEntry(makeEntry(), "json");
		expect(result.filename).toBe("2025-06-15-My-Day.json");
		expect(result.mime).toBe("application/json");
		const parsed = JSON.parse(await blobText(result.blob));
		expect(parsed.id).toBe("entry-1");
		expect(parsed.mood).toBe("good");
		expect(parsed.tags).toEqual(["daily", "reflection"]);
	});

	it("omits mood from frontmatter when null", async () => {
		const result = exportEntry(makeEntry({ mood: null }), "markdown");
		const text = await blobText(result.blob);
		expect(text).not.toContain("mood:");
	});

	it("omits empty tags from frontmatter", async () => {
		const result = exportEntry(makeEntry({ tags: [] }), "markdown");
		const text = await blobText(result.blob);
		expect(text).not.toContain("tags:");
	});

	it("sanitizes title in filename", async () => {
		const result = exportEntry(makeEntry({ title: "Test!! @Special" }), "markdown");
		expect(result.filename).toBe("2025-06-15-Test-Special.md");
	});
});

describe("exportAll", () => {
	it("exports JSON with metadata and entries", async () => {
		const entries = [makeEntry()];
		const result = await exportAll(entries, "json");
		expect(result.filename).toMatch(/^journal-export-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
		const parsed = JSON.parse(await blobText(result.blob));
		expect(parsed.entries).toHaveLength(1);
		expect(parsed.version).toBe(1);
		expect(parsed.templates).toEqual([]);
	});

	it("exports markdown zip archive", async () => {
		const entries = [makeEntry(), makeEntry({ id: "entry-2", title: "Second" })];
		const result = await exportAll(entries, "markdown");
		expect(result.filename).toMatch(/\.zip$/);
	});

	it("includes templates, tags, goals in JSON when provided", async () => {
		const entries = [makeEntry()];
		const templates: JournalTemplate[] = [];
		const tags: Tag[] = [];
		const goals: Goal[] = [];
		const result = await exportAll(entries, "json", { templates, tags, goals });
		const parsed = JSON.parse(await blobText(result.blob));
		expect(parsed.templates).toEqual([]);
		expect(parsed.tags).toEqual([]);
		expect(parsed.goals).toEqual([]);
	});
});

describe("downloadBlob", () => {
	it("creates anchor element and revokes object URL", () => {
		const blob = new Blob(["hello"]);
		const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
		const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

		downloadBlob(blob, "test.txt");

		expect(createSpy).toHaveBeenCalledWith(blob);
		expect(clickSpy).toHaveBeenCalled();
		createSpy.mockRestore();
		revokeSpy.mockRestore();
		clickSpy.mockRestore();
	});
});
