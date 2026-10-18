import { readFile } from '../store';

/** Shrink a photo before storing it, so the browser's storage doesn't fill up. */
export async function downscaleImage(file: File, maxPx = 1200): Promise<string> {
  const src = await readFile(file, 'dataUrl');
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = src;
  });
  const k = Math.min(1, maxPx / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}

