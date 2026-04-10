"use client";

const MAX_REFERENCE_DIMENSION = 960;
const REFERENCE_PREVIEW_QUALITY = 0.82;

function loadImage(objectUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode reference image."));
    image.src = objectUrl;
  });
}

export async function createReferenceImagePreview(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_REFERENCE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to prepare reference preview canvas.");
    }

    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/webp", REFERENCE_PREVIEW_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
