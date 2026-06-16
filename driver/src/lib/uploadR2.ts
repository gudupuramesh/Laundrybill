/**
 * Cloudflare R2 image upload — same contract as the owner app.
 * POST {R2_WORKER_URL}/upload  FormData { file, shopId, folder } → { key, publicUrl }.
 * Folders used by the driver app: "pickup-photos", "delivery-photos", "plant-photos".
 */
const R2_WORKER_URL =
  process.env.EXPO_PUBLIC_R2_WORKER_URL || 'https://laundryboss-r2.gudupuramesh.workers.dev';

export type R2Folder = 'pickup-photos' | 'delivery-photos' | 'plant-photos' | 'damage-photos';

export async function uploadImageToR2(
  shopId: string,
  uri: string,
  folder: R2Folder,
  fileName?: string,
): Promise<{ key: string; publicUrl: string }> {
  const name = fileName || `${folder}-${Date.now()}.jpg`;
  const formData = new FormData();
  formData.append('file', { uri, name, type: 'image/jpeg' } as any);
  formData.append('shopId', shopId);
  formData.append('folder', folder);

  const res = await fetch(`${R2_WORKER_URL}/upload`, { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload photo');
  }
  const data = await res.json();
  return { key: data.key, publicUrl: data.publicUrl };
}
