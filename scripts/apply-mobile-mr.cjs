/**
 * Merge mobile.* Marathi strings into src/locales/mr.json
 * Run: node scripts/apply-mobile-mr.cjs
 * (Regenerate scripts/mobile-mr.json with node scripts/generate-mobile-mr-json.cjs if needed.)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const mrPath = path.join(root, "src/locales/mr.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileMrPath = path.join(__dirname, "mobile-mr.json");

const mr = JSON.parse(fs.readFileSync(mrPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileMr = JSON.parse(fs.readFileSync(mobileMrPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const mrKeys = Object.keys(mobileMr).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(mrKeys)) {
  console.error("mobile-mr.json keys do not match en.json mobile keys");
  process.exit(1);
}

mr.mobile = mobileMr;
fs.writeFileSync(mrPath, JSON.stringify(mr, null, 2) + "\n", "utf8");
console.log("Updated mr.json with mobile.* (Marathi)");
