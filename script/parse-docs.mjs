import { createRequire } from "module";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const DOCS_DIR = join(import.meta.dirname, "..", "data", "docs");
const OUT_PATH = join(import.meta.dirname, "..", "data", "dermatology-kb.json");

function clean(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromFilename(file) {
  return basename(file, extname(file));
}

async function extractDocx(filePath) {
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return clean(result.value);
}

async function extractPdf(filePath) {
  const buffer = await readFile(filePath);
  const data = await pdfParse(buffer);
  return clean(data.text);
}

async function main() {
  await mkdir(join(import.meta.dirname, "..", "data"), { recursive: true });
  const entries = await readdir(DOCS_DIR);
  const files = entries.filter((f) => /\.(docx|pdf)$/i.test(f));
  console.log(`Found ${files.length} document(s) in ${DOCS_DIR}`);

  const documents = [];

  for (const file of files) {
    const filePath = join(DOCS_DIR, file);
    const ext = extname(file).toLowerCase();
    try {
      const content =
        ext === ".docx"
          ? await extractDocx(filePath)
          : ext === ".pdf"
            ? await extractPdf(filePath)
            : "";
      if (!content) {
        console.warn(`  ⚠ ${file}: nội dung rỗng, bỏ qua.`);
        continue;
      }
      documents.push({
        source: file,
        title: titleFromFilename(file),
        content,
      });
      console.log(`  ✓ ${file}: ${content.length} ký tự`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  await writeFile(OUT_PATH, JSON.stringify(documents, null, 2), "utf-8");
  const totalChars = documents.reduce((sum, d) => sum + d.content.length, 0);
  console.log(
    `\nĐã xuất ${documents.length} tài liệu (${totalChars} ký tự) → ${OUT_PATH}`
  );
}

main();
