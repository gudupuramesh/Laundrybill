/**
 * Merge mobile.* Bengali strings into src/locales/bn.json
 * Run: node scripts/apply-mobile-bn.cjs
 * (Regenerate scripts/mobile-bn.json with node scripts/generate-mobile-bn-json.cjs if needed.)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const bnPath = path.join(root, "src/locales/bn.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileBnPath = path.join(__dirname, "mobile-bn.json");

const bn = JSON.parse(fs.readFileSync(bnPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileBn = JSON.parse(fs.readFileSync(mobileBnPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const bnKeys = Object.keys(mobileBn).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(bnKeys)) {
  console.error("mobile-bn.json keys do not match en.json mobile keys");
  process.exit(1);
}

bn.mobile = mobileBn;
fs.writeFileSync(bnPath, JSON.stringify(bn, null, 2) + "\n", "utf8");
console.log("Updated bn.json with mobile.* (Bengali)");
