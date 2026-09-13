import {
  isSupportedPlayerPhoto,
  MAX_PLAYER_PHOTO_PIXELS,
  MAX_PLAYER_PHOTO_SIZE_BYTES,
  MAX_PLAYER_PHOTO_SOURCE_SIZE_BYTES,
  MAX_PLAYER_PHOTO_SOURCE_SIZE_MB,
  PLAYER_AVATAR_QUALITY,
  PLAYER_AVATAR_SIZE_PX
} from "@/lib/photo-constraints";

export async function preparePlayerPhoto(file: File): Promise<File> {
  if (!isSupportedPlayerPhoto(file) || file.size === 0) {
    throw new Error("Seleccioná una imagen JPG, PNG o WEBP válida.");
  }
  if (file.size > MAX_PLAYER_PHOTO_SOURCE_SIZE_BYTES) {
    throw new Error(`El archivo original supera ${MAX_PLAYER_PHOTO_SOURCE_SIZE_MB} MB.`);
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const source = new Image();
    await new Promise<void>((resolve, reject) => {
      source.onload = () => resolve();
      source.onerror = () => reject(new Error("No pudimos leer esta imagen. Probá con otra foto."));
      source.src = objectUrl;
    });
    if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth * source.naturalHeight > MAX_PLAYER_PHOTO_PIXELS) {
      throw new Error("La imagen es demasiado grande. Elegí una versión de hasta 40 megapíxeles.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = PLAYER_AVATAR_SIZE_PX;
    canvas.height = PLAYER_AVATAR_SIZE_PX;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No pudimos preparar la foto en este navegador.");
    const cropSize = Math.min(source.naturalWidth, source.naturalHeight);
    context.drawImage(source, (source.naturalWidth - cropSize) / 2, (source.naturalHeight - cropSize) / 2, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No pudimos comprimir la foto.")), "image/webp", PLAYER_AVATAR_QUALITY / 100);
    });
    if (blob.size > MAX_PLAYER_PHOTO_SIZE_BYTES) throw new Error("La imagen preparada supera 5 MB. Elegí otra foto.");
    if (!["image/webp", "image/png"].includes(blob.type)) throw new Error("El navegador no pudo preparar un formato compatible.");
    const extension = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
