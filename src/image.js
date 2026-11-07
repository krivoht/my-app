// Zmenší fotku z iPhonu (i HEIC, který Safari umí dekódovat) na JPEG.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Fotku se nepodařilo načíst."));
    };
    img.src = url;
  });
}

function toJpeg(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * @returns {Promise<{base64: string, thumbDataUrl: string}>}
 *   base64 – obrázek pro Claude (max 1568 px), thumbDataUrl – malý náhled do deníku.
 */
export async function prepareImage(file) {
  const img = await loadImage(file);
  const full = toJpeg(img, 1568, 0.85);
  const thumb = toJpeg(img, 240, 0.7);
  return { base64: full.split(",")[1], thumbDataUrl: thumb };
}
