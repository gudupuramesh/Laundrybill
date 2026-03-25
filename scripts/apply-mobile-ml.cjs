/**
 * Merge mobile.* Malayalam strings into src/locales/ml.json
 * Run: node scripts/apply-mobile-ml.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const mlPath = path.join(root, "src/locales/ml.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileMlPath = path.join(__dirname, "mobile-ml.json");

const ml = JSON.parse(fs.readFileSync(mlPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileMl = JSON.parse(fs.readFileSync(mobileMlPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const mlKeys = Object.keys(mobileMl).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(mlKeys)) {
  console.error("mobile-ml.json keys do not match en.json mobile keys");
  process.exit(1);
}

ml.mobile = mobileMl;
fs.writeFileSync(mlPath, JSON.stringify(ml, null, 2) + "\n", "utf8");
console.log("Updated ml.json with mobile.* (Malayalam)");
