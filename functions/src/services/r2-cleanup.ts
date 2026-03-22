/**
 * R2 cleanup helpers for Cloud Functions.
 * Calls the R2 worker to delete objects by key.
 * Key is derived from public URL path (e.g. https://pub-xxx.r2.dev/shopId/folder/file.jpg → shopId/folder/file.jpg).
 */

const R2_WORKER_URL = process.env.R2_WORKER_URL || "";

/**
 * Derive R2 object key from a public URL.
 * R2 public URLs are typically https://domain/path so the key is the path without leading slash.
 */
export function keyFromPublicUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    try {
        const u = new URL(url);
        const path = u.pathname.replace(/^\//, "");
        return path || null;
    } catch {
        return null;
    }
}

/**
 * Delete a single object from R2 by key.
 * Fails silently (logs) so bulk cleanup can continue.
 */
export async function deleteFromR2ByKey(key: string): Promise<boolean> {
    if (!R2_WORKER_URL) {
        console.warn("R2_WORKER_URL not set, skipping R2 delete");
        return false;
    }
    try {
        const response = await fetch(`${R2_WORKER_URL}/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
        });
        if (!response.ok) {
            console.warn(`R2 delete failed for key ${key}: ${response.status}`);
            return false;
        }
        return true;
    } catch (err) {
        console.warn(`R2 delete error for key ${key}:`, err);
        return false;
    }
}

/**
 * Delete from R2 by public URL (derives key from URL).
 */
export async function deleteFromR2ByUrl(url: string): Promise<boolean> {
    const key = keyFromPublicUrl(url);
    if (!key) return false;
    return deleteFromR2ByKey(key);
}
