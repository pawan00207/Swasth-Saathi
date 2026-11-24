import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { generatePdf } from "../src/lib/generatePdf";

describe("shared PDF generator", () => {
  it("embeds the Devanagari font and saves a PDF", async () => {
    const font = await readFile(new URL("../public/fonts/NotoSansDevanagari-Regular.ttf", import.meta.url));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(font)));
    const fileName = join(tmpdir(), `swasth-saathi-${randomUUID()}.pdf`);

    try {
      await generatePdf({
        fileName,
        title: "Medical report summary",
        draw: (document, fontFamily) => {
          document.setFont(fontFamily);
          document.text("भारत", 16, 44);
        },
      });

      const pdf = await readFile(fileName);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    } finally {
      await rm(fileName, { force: true });
      vi.unstubAllGlobals();
    }
  });
});
