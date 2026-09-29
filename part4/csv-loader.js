// Part 4: CSV loader for Part 3 files already stored in this repository.
const FILES = [
  "sales_2026_06.csv",
  "sales_2026_07.csv",
  "sales_2026_08.csv",
  "sales_2026_09.csv"
];

export function parseCSV(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(v => v.trim());

  return lines.slice(1).filter(Boolean).map(line => {
    const values = line.split(",");
    return Object.fromEntries(
      headers.map((key, i) => [key, values[i]?.trim() ?? ""])
    );
  });
}

export async function loadPart3CSV(basePath = "../data") {
  const chunks = await Promise.all(
    FILES.map(async file => {
      const response = await fetch(`${basePath}/${file}`);
      if (!response.ok) throw new Error(`CSV load failed: ${file}`);
      return parseCSV(await response.text());
    })
  );
  return chunks.flat();
}
