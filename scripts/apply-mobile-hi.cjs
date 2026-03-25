/**
 * Merge mobile.* Hindi strings into src/locales/hi.json
 * Run: node scripts/apply-mobile-hi.cjs
 * (Regenerate scripts/mobile-hi.json with node scripts/generate-mobile-hi-json.cjs if needed.)
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const hiPath = path.join(root, "src/locales/hi.json");
const enPath = path.join(root, "src/locales/en.json");
const mobileHiPath = path.join(__dirname, "mobile-hi.json");

const hi = JSON.parse(fs.readFileSync(hiPath, "utf8"));
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
const mobileHi = JSON.parse(fs.readFileSync(mobileHiPath, "utf8"));

const enKeys = Object.keys(en.mobile).sort();
const hiKeys = Object.keys(mobileHi).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(hiKeys)) {
  console.error("mobile-hi.json keys do not match en.json mobile keys");
  process.exit(1);
}

hi.mobile = mobileHi;
fs.writeFileSync(hiPath, JSON.stringify(hi, null, 2) + "\n", "utf8");
console.log("Updated hi.json with mobile.* (Hindi)");
