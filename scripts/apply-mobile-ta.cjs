/**
 * Merge mobile.* Tamil strings into src/locales/ta.json
 * Run: node scripts/apply-mobile-ta.cjs
 * (Regenerate scripts/mobile-ta.json with node scripts/generate-mobile-ta-json.cjs if needed.)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const taPath = path.join(root, "src/locales/ta.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileTaPath = path.join(__dirname, "mobile-ta.json");

const ta = JSON.parse(fs.readFileSync(taPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileTa = JSON.parse(fs.readFileSync(mobileTaPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const taKeys = Object.keys(mobileTa).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(taKeys)) {
  console.error("mobile-ta.json keys do not match en.json mobile keys");
  process.exit(1);
}

ta.mobile = mobileTa;
fs.writeFileSync(taPath, JSON.stringify(ta, null, 2) + "\n", "utf8");
console.log("Updated ta.json with mobile.* (Tamil)");
