// Trích khoá dịch của trang khách & đối chiếu với từ điển.
//   node scripts/i18n/extract.mjs            → in số khoá thiếu theo từng ngôn ngữ
//   node scripts/i18n/extract.mjs --missing  → ghi danh sách khoá CHƯA có bản dịch ra scripts/i18n/out/missing.json
// Khoá = (1) đối số chuỗi của t()/tr(); (2) mọi chuỗi/JSX text tiếng Việt còn lại trong mã trang khách
// và các file lib chứa nhãn hiển thị (hằng nhãn được dịch lúc hiển thị bằng t(biến)).
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const LIB_FILES = ["constants", "phone", "feedback", "trust-popup", "itinerary", "availability", "booking-detail-lines", "weekend-policy", "customer", "site", "validation", "surcharges", "cancel-reason", "date-format", "rental-days", "occupancy", "combo-pricing", "booking", "cabin", "combo", "queries", "cabin-trips", "checkin-map", "og"];

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== "admin" && e.name !== "i18n") walk(p, o);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) o.push(p);
  }
  return o;
}
const files = [
  ...walk("src/app/(site)"),
  ...walk("src/components"),
  ...walk("src/app/api").filter((f) => !f.includes(`${path.sep}admin${path.sep}`) && !f.includes(`${path.sep}cron${path.sep}`)),
  ...LIB_FILES.map((f) => `src/lib/${f}.ts`).filter((f) => fs.existsSync(f)),
  "src/app/layout.tsx",
];

const keys = new Map(); // key -> first file
const add = (k, f) => {
  const s = k.trim();
  if (s && !keys.has(s)) keys.set(s, f);
};
function jsxNorm(raw) {
  const lines = raw.split(/\r\n|\n|\r/);
  const parts = [];
  lines.forEach((line, i) => {
    let s = line.replace(/\t/g, " ");
    if (i > 0) s = s.replace(/^ +/, "");
    if (i < lines.length - 1) s = s.replace(/ +$/, "");
    if (s) parts.push(s);
  });
  return parts.join(" ");
}
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  (function v(n) {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ["t", "tr", "i18nMeta"].includes(n.expression.text)) {
      const a = n.arguments[0];
      if (a && (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))) add(a.text, f);
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && VI.test(n.text)) {
      const p = n.parent;
      const isImport = ts.isImportDeclaration(p) || ts.isExportDeclaration(p);
      const isLogic =
        (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) ||
        ts.isCaseClause(p) ||
        (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ["includes", "startsWith", "replace", "test", "split", "indexOf", "log", "warn", "error"].includes(p.expression.name.text));
      if (!isImport && !isLogic) add(n.text, f);
    }
    if (n.kind === ts.SyntaxKind.JsxText && VI.test(n.text)) add(jsxNorm(n.text), f);
    ts.forEachChild(n, v);
  })(sf);
}

const out = {};
for (const l of ["en", "zh", "ko"]) out[l] = JSON.parse(fs.readFileSync(`src/lib/i18n/dict/${l}.json`, "utf8"));
const missing = [...keys.keys()].filter((k) => !(k in out.en) || !(k in out.zh) || !(k in out.ko));
console.log(`keys: ${keys.size}; missing en/zh/ko: ${["en", "zh", "ko"].map((l) => [...keys.keys()].filter((k) => !(k in out[l])).length).join("/")}`);
if (process.argv.includes("--missing")) {
  fs.mkdirSync("scripts/i18n/out", { recursive: true });
  const byFile = {};
  for (const k of missing) (byFile[keys.get(k).split(path.sep).join("/")] ??= []).push(k);
  fs.writeFileSync("scripts/i18n/out/missing.json", JSON.stringify(byFile, null, 1));
  console.log(`→ scripts/i18n/out/missing.json (${missing.length} khoá, ${JSON.stringify(missing).length} ký tự)`);
}
