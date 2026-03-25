/**
 * Merge mobile.* Kannada strings into src/locales/kn.json
 * Run: node scripts/apply-mobile-kn.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const knPath = path.join(root, "src/locales/kn.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileKnPath = path.join(__dirname, "mobile-kn.json");

const kn = JSON.parse(fs.readFileSync(knPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileKn = JSON.parse(fs.readFileSync(mobileKnPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const knKeys = Object.keys(mobileKn).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(knKeys)) {
  console.error("mobile-kn.json keys do not match en.json mobile keys");
  process.exit(1);
}

kn.mobile = mobileKn;
fs.writeFileSync(knPath, JSON.stringify(kn, null, 2) + "\n", "utf8");
console.log("Updated kn.json with mobile.* (Kannada)");
