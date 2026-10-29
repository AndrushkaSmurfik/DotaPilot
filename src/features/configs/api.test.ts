import { describe, expect, it, vi } from "vitest";
import { formatSize, importMany } from "./api";

describe("configs api helpers", () => {
  it("formats sizes", () => {
    expect(formatSize(512)).toBe("512 Б");
    expect(formatSize(2048)).toBe("2.0 КБ");
  });

  it("imports what it can and reports the rest", async () => {
    const importOne = vi
      .fn()
      .mockResolvedValueOnce({ name: "a.cfg", size: 1, modified: 0 })
      .mockRejectedValueOnce("Можно загружать только файлы .cfg");
    const r = await importMany(["C:\\cfg\\a.cfg", "C:\\cfg\\b.txt"], importOne);
    expect(r.imported.map((e) => e.name)).toEqual(["a.cfg"]);
    expect(r.errors).toEqual(["b.txt: Можно загружать только файлы .cfg"]);
  });
});
