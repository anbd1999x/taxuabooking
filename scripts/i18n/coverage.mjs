// Kiểm độ phủ: chuỗi nào trong <nguồn.json> vẫn chưa dịch được (sau khi áp từ điển + các bản dịch trong <rows.json>).
//   node scripts/i18n/coverage.mjs <nguồn.json> <rows.json> [out-còn-thiếu.json]
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const [srcFile, rowsFile, outFile] = process.argv.slice(2);
// nạp makeT từ src/lib/i18n/config.ts (transpile tại chỗ)
const code = ts.transpileModule(fs.readFileSync("src/lib/i18n/config.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", code)(mod, mod.exports, createRequire(import.meta.url));
const { makeT } = mod.exports;
const dict = JSON.parse(fs.readFileSync("src/lib/i18n/dict/en.json", "utf8"));
const content = {};
for (const [s, en] of fs.existsSync(rowsFile) ? JSON.parse(fs.readFileSync(rowsFile, "utf8")) : []) content[s.trim()] = en;
const t = makeT(dict, content);
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const src = JSON.parse(fs.readFileSync(srcFile, "utf8"));
const left = src.map((s, i) => [i, s]).filter(([, s]) => t(s) === s && VI.test(s));
console.log(`còn ${left.length}/${src.length} chưa dịch`);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(left));
