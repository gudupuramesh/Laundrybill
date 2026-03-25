/**
 * Merge mobile.* Gujarati strings into src/locales/gu.json
 * Run: node scripts/apply-mobile-gu.cjs
 * (gu.json must exist — base copy from en.json if new.)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const guPath = path.join(root, "src/locales/gu.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileGuPath = path.join(__dirname, "mobile-gu.json");

if (!fs.existsSync(guPath)) {
  console.error("Missing src/locales/gu.json — copy en.json to gu.json first.");
  process.exit(1);
}

const gu = JSON.parse(fs.readFileSync(guPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileGu = JSON.parse(fs.readFileSync(mobileGuPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const guKeys = Object.keys(mobileGu).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(guKeys)) {
  console.error("mobile-gu.json keys do not match en.json mobile keys");
  process.exit(1);
}

gu.mobile = mobileGu;
fs.writeFileSync(guPath, JSON.stringify(gu, null, 2) + "\n", "utf8");
console.log("Updated gu.json with mobile.* (Gujarati)");
