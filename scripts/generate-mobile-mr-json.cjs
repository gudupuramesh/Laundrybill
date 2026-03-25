/**
 * One-off: translate en.json mobile.* to Marathi via Google Translate (gtx),
 * preserving {{placeholders}}. Writes scripts/mobile-mr.json
 * Run: node scripts/generate-mobile-mr-json.cjs
 */
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const enPath = path.join(root, "src/locales/en.json");
const outPath = path.join(__dirname, "mobile-mr.json");

function protect(s) {
  const parts = [];
  const masked = s.replace(/\{\{[^}]+\}\}/g, (m) => {
    const i = parts.length;
    parts.push(m);
    return `⟦${i}⟧`;
  });
  return { masked, parts };
}

function unprotect(s, parts) {
  return s.replace(/⟦(\d+)⟧/g, (_, i) => parts[+i]);
}

function translate(text) {
  const q = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=mr&dt=t&q=${q}`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(d);
          resolve(j[0].map((x) => x[0]).join(""));
        } catch (e) {
          reject(new Error(`Bad response: ${d.slice(0, 200)}`));
        }
      });
    }).on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
  const keys = Object.keys(en.mobile);
  const mobileMr = {};
  const delayMs = 120;

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const raw = en.mobile[k];
    const { masked, parts } = protect(raw);
    let tr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        tr = await translate(masked);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await sleep(500 * (attempt + 1));
      }
    }
    const out = unprotect(tr, parts);
    const openCount = (raw.match(/\{\{/g) || []).length;
    const outOpen = (out.match(/\{\{/g) || []).length;
    if (openCount !== outOpen) {
      console.warn(`Placeholder mismatch for ${k}, using English fallback`);
      mobileMr[k] = raw;
    } else {
      mobileMr[k] = out;
    }
    if ((i + 1) % 50 === 0) console.error(`… ${i + 1}/${keys.length}`);
    await sleep(delayMs);
  }

  fs.writeFileSync(outPath, JSON.stringify(mobileMr, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath} (${keys.length} keys)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
