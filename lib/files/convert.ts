"use client";
/**
 * Turn uploaded files into images that fit the hwpx: PDF pages are rendered to JPEG,
 * large photos are scaled down so the document stays small.
 */

export interface ConvertedImage {
  name: string;
  type: string;
  blob: Blob;
}

const MAX_SIDE = 2000; // px; ~ 170 dpi across an A4 page width
const JPEG_QUALITY = 0.85;

function canvasToBlob(c: HTMLCanvasElement, type = "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), type, JPEG_QUALITY),
  );
}

async function pdfToImages(file: File, onProgress?: (msg: string) => void): Promise<ConvertedImage[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const base = file.name.replace(/\.pdf$/i, "");
  const out: ConvertedImage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    onProgress?.(`${file.name} ${i}/${doc.numPages}쪽 변환 중`);
    const page = await doc.getPage(i);
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_SIDE / Math.max(v1.width, v1.height), 3);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    out.push({ name: `${base} (${i}쪽).jpg`, type: "image/jpeg", blob: await canvasToBlob(canvas) });
    page.cleanup();
  }
  await task.destroy();
  return out;
}

async function shrinkImage(file: File): Promise<ConvertedImage> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const longest = Math.max(bmp.width, bmp.height);
  // small enough and not needing rotation fix: keep the original bytes
  if (longest <= MAX_SIDE && file.size < 1.5 * 1024 * 1024 && /^image\/(png|jpeg)$/.test(file.type)) {
    bmp.close();
    return { name: file.name, type: file.type, blob: file };
  }
  const s = Math.min(1, MAX_SIDE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return { name: file.name.replace(/\.\w+$/, ".jpg"), type: "image/jpeg", blob: await canvasToBlob(canvas) };
}

export const ACCEPT = "image/png,image/jpeg,image/gif,image/bmp,image/webp,application/pdf";

/** Convert a mixed list of PDFs and images. Unsupported files are reported in `skipped`. */
export async function convertFiles(
  files: File[],
  onProgress?: (msg: string) => void,
): Promise<{ images: ConvertedImage[]; skipped: string[] }> {
  const images: ConvertedImage[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) images.push(...(await pdfToImages(f, onProgress)));
      else if (/^image\//.test(f.type)) {
        onProgress?.(`${f.name} 처리 중`);
        images.push(await shrinkImage(f));
      } else skipped.push(f.name);
    } catch (e) {
      console.error(e);
      skipped.push(f.name);
    }
  }
  return { images, skipped };
}
