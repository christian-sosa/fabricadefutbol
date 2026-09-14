import { isSupportedOrganizationImageFile, MAX_ORGANIZATION_IMAGE_PIXELS, MAX_ORGANIZATION_IMAGE_SIZE_BYTES, MAX_ORGANIZATION_IMAGE_SOURCE_SIZE_BYTES, ORGANIZATION_IMAGE_HEIGHT_PX, ORGANIZATION_IMAGE_QUALITY, ORGANIZATION_IMAGE_WIDTH_PX } from "@/lib/organization-image-constraints";

export async function prepareOrganizationImage(file: File): Promise<File> {
  if (!isSupportedOrganizationImageFile(file) || !file.size) throw new Error("Seleccioná una imagen JPG, PNG o WEBP válida.");
  if (file.size > MAX_ORGANIZATION_IMAGE_SOURCE_SIZE_BYTES) throw new Error("El archivo original supera 20 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const source = new Image();
    await new Promise<void>((resolve, reject) => {
      source.onload = () => resolve();
      source.onerror = () => reject(new Error("No pudimos leer esta imagen. Probá con otra foto."));
      source.src = objectUrl;
    });
    if (!source.naturalWidth || !source.naturalHeight || source.naturalWidth * source.naturalHeight > MAX_ORGANIZATION_IMAGE_PIXELS) throw new Error("Elegí una imagen de hasta 40 megapíxeles.");
    const canvas = document.createElement("canvas");
    canvas.width = ORGANIZATION_IMAGE_WIDTH_PX;
    canvas.height = ORGANIZATION_IMAGE_HEIGHT_PX;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No pudimos preparar la portada en este navegador.");
    const ratio = canvas.width / canvas.height;
    const width = Math.min(source.naturalWidth, source.naturalHeight * ratio);
    const height = width / ratio;
    context.drawImage(source, (source.naturalWidth - width) / 2, (source.naturalHeight - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No pudimos comprimir la portada.")), "image/webp", ORGANIZATION_IMAGE_QUALITY / 100);
    });
    if (blob.size > MAX_ORGANIZATION_IMAGE_SIZE_BYTES) throw new Error("La portada preparada supera 3 MB. Elegí otra imagen.");
    if (!["image/webp", "image/png"].includes(blob.type)) throw new Error("El navegador no pudo preparar un formato compatible.");
    return new File([blob], `portada.${blob.type === "image/webp" ? "webp" : "png"}`, { type: blob.type });
  } finally { URL.revokeObjectURL(objectUrl); }
}
