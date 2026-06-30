// Stub for @firebase/util's `./postinstall.mjs`, which is referenced by its ESM/CJS
// builds but is NOT shipped in the 1.15.x dist (a known @firebase/util packaging bug).
// Metro can't resolve the missing file, which crashes the whole bundle on load.
//
// `getDefaultsFromPostinstall()` normally returns config injected at package
// postinstall time; returning undefined makes getDefaults() fall back to env vars /
// other sources, which is the correct behaviour in React Native (no postinstall step).
export function getDefaultsFromPostinstall() {
    return undefined;
}
