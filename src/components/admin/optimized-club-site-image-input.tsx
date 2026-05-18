"use client";

import { useId, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";

const MAX_DIRECT_ACTION_FILE_SIZE_MB = 8;
const MAX_DIRECT_ACTION_FILE_SIZE_BYTES = MAX_DIRECT_ACTION_FILE_SIZE_MB * 1024 * 1024;

const IMAGE_PRESETS = {
  hero: {
    fit: "contain",
    height: 1600,
    quality: 0.92,
    width: 2400
  },
  product: {
    fit: "cover",
    height: 1000,
    quality: 0.86,
    width: 1000
  }
} as const;

type OptimizedClubSiteImageInputProps = {
  className?: string;
  helperText: ReactNode;
  id?: string;
  maxSourceSizeMb: number;
  name: string;
  required?: boolean;
  variant: keyof typeof IMAGE_PRESETS;
};

function formatMb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getOutputFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "imagen"}.webp`;
}

function isSupportedImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = objectUrl;
  });
}

function getCoverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return {
      height: sourceHeight,
      width,
      x: (sourceWidth - width) / 2,
      y: 0
    };
  }

  const height = sourceWidth / targetRatio;
  return {
    height,
    width: sourceWidth,
    x: 0,
    y: (sourceHeight - height) / 2
  };
}

function getContainDraw(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight, 1);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    height,
    width,
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2
  };
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("El navegador no pudo generar WEBP."));
      },
      "image/webp",
      quality
    );
  });
}

async function optimizeImageFile(file: File, variant: keyof typeof IMAGE_PRESETS) {
  const preset = IMAGE_PRESETS[variant];
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("El navegador no pudo preparar la imagen.");
  }

  canvas.width = preset.width;
  canvas.height = preset.height;

  if (preset.fit === "contain") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, preset.width, preset.height);
    const draw = getContainDraw(image.naturalWidth, image.naturalHeight, preset.width, preset.height);
    context.drawImage(image, draw.x, draw.y, draw.width, draw.height);
  } else {
    const crop = getCoverCrop(image.naturalWidth, image.naturalHeight, preset.width, preset.height);
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      preset.width,
      preset.height
    );
  }

  let quality = preset.quality;
  let blob = await canvasToWebpBlob(canvas, quality);
  while (blob.size > MAX_DIRECT_ACTION_FILE_SIZE_BYTES && quality > 0.62) {
    quality -= 0.08;
    blob = await canvasToWebpBlob(canvas, quality);
  }

  if (blob.size > MAX_DIRECT_ACTION_FILE_SIZE_BYTES) {
    throw new Error(`No se pudo dejar la imagen por debajo de ${MAX_DIRECT_ACTION_FILE_SIZE_MB} MB.`);
  }

  return new File([blob], getOutputFileName(file.name), {
    lastModified: Date.now(),
    type: "image/webp"
  });
}

export function OptimizedClubSiteImageInput({
  className,
  helperText,
  id,
  maxSourceSizeMb,
  name,
  required = false,
  variant
}: OptimizedClubSiteImageInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [message, setMessage] = useState<ReactNode>(helperText);
  const [error, setError] = useState(false);

  return (
    <div className={className}>
      <Input
        accept="image/jpeg,image/png,image/webp"
        id={inputId}
        name={name}
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (!file) {
            setError(false);
            setMessage(helperText);
            return;
          }

          if (file.size > maxSourceSizeMb * 1024 * 1024) {
            setError(true);
            setMessage(`El archivo supera ${maxSourceSizeMb} MB.`);
            input.value = "";
            return;
          }

          if (!isSupportedImageFile(file)) {
            setError(true);
            setMessage("Formato no soportado. Usa JPG, PNG o WEBP.");
            input.value = "";
            return;
          }

          if (typeof DataTransfer === "undefined") {
            if (file.size <= MAX_DIRECT_ACTION_FILE_SIZE_BYTES) {
              setError(false);
              setMessage(`Lista para subir: ${formatMb(file.size)}.`);
              return;
            }
            setError(true);
            setMessage("Tu navegador no permite optimizar esta imagen antes de subirla.");
            input.value = "";
            return;
          }

          setError(false);
          setMessage("Optimizando imagen...");

          const form = input.form;
          const preventSubmit = (submitEvent: SubmitEvent) => {
            submitEvent.preventDefault();
            setMessage("Espera a que termine la optimizacion de la imagen.");
          };
          form?.addEventListener("submit", preventSubmit);

          try {
            const optimizedFile = await optimizeImageFile(file, variant);
            const currentFile = input.files?.[0];
            if (!currentFile || currentFile.name !== file.name || currentFile.size !== file.size) {
              return;
            }

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(optimizedFile);
            input.files = dataTransfer.files;
            setMessage(`Lista para subir: ${formatMb(file.size)} -> ${formatMb(optimizedFile.size)}.`);
          } catch (optimizationError) {
            setError(true);
            setMessage(optimizationError instanceof Error ? optimizationError.message : "No se pudo optimizar la imagen.");
            input.value = "";
          } finally {
            form?.removeEventListener("submit", preventSubmit);
          }
        }}
        required={required}
        type="file"
      />
      <p className={`mt-1 text-xs ${error ? "text-danger" : "text-slate-500"}`}>
        {message}
      </p>
    </div>
  );
}
