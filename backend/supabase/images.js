import crypto from "node:crypto";
import path from "node:path";
import { client, PUBLIC_BUCKET } from "./client.js";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function normalizeFolder(folder = "uploads") {
  const cleaned = folder.trim().replace(/^\/+|\/+$/g, "");
  return cleaned || "uploads";
}

function buildObjectPath(originalName = "", folder = "uploads") {
  const safeFolder = normalizeFolder(folder);
  const extension = path.extname(originalName).toLowerCase();
  const safeExtension = extension && extension.length <= 12 ? extension : ".bin";
  return `${safeFolder}/${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
}

function toPublicUrl(objectPath) {
  return client.storage.from(PUBLIC_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

function normalizeUploadedMimeType(uploadedMimeType) {
  return uploadedMimeType === "image/jpg" ? "image/jpeg" : uploadedMimeType;
}

function isMimeEquivalent(uploadedMimeType, detectedMimeType) {
  if (uploadedMimeType === detectedMimeType) {
    return true;
  }

  if (uploadedMimeType === "image/jpg" && detectedMimeType === "image/jpeg") {
    return true;
  }

  return false;
}

function detectImageMimeFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF: GIF87a / GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // WEBP: RIFF....WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function uploadPublicImage(file, folder = "uploads") {
  if (!file?.buffer) {
    return { data: null, error: new Error("Image file is required.") };
  }

  const uploadedMimeType = normalizeUploadedMimeType((file.mimetype || "").toLowerCase());
  if (!ALLOWED_IMAGE_MIME_TYPES.has(uploadedMimeType)) {
    return { data: null, error: new Error("Unsupported image format. Allowed: jpeg, png, webp, gif.") };
  }

  const detectedMimeType = detectImageMimeFromBuffer(file.buffer);
  if (!detectedMimeType) {
    return { data: null, error: new Error("Invalid or corrupted image file.") };
  }

  if (!isMimeEquivalent(uploadedMimeType, detectedMimeType)) {
    return { data: null, error: new Error("Image type does not match file content.") };
  }

  const objectPath = buildObjectPath(file.originalname || "", folder);
  const { error } = await client.storage.from(PUBLIC_BUCKET).upload(objectPath, file.buffer, {
    contentType: detectedMimeType,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      path: objectPath,
      url: toPublicUrl(objectPath),
    },
    error: null,
  };
}

export async function listPublicImages(prefix = "") {
  const normalizedPrefix = prefix.trim().replace(/^\/+|\/+$/g, "");
  const { data, error } = await client.storage.from(PUBLIC_BUCKET).list(normalizedPrefix || undefined, {
    limit: 100,
    offset: 0,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    return { data: null, error };
  }

  const items = (data || []).map((file) => {
    const objectPath = normalizedPrefix ? `${normalizedPrefix}/${file.name}` : file.name;
    return {
      name: file.name,
      path: objectPath,
      url: toPublicUrl(objectPath),
    };
  });

  return { data: items, error: null };
}
