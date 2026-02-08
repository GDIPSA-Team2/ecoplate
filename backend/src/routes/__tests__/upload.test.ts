import { describe, expect, test } from "bun:test";
import {
  validateImageFile,
  validateImageMagicBytes,
  generateSecureFilename,
  isAllowedImageMimeType,
  isAllowedImageExtension,
  getFileExtension,
  sanitizeFilename,
} from "../../utils/file-utils";

// Helper to create a mock File with given bytes
function createMockFile(
  bytes: number[],
  name: string,
  type: string,
  size?: number
): File {
  const buffer = new Uint8Array(bytes);
  const blob = new Blob([buffer], { type });
  // Override size if specified (for testing oversized files)
  const file = new File([blob], name, { type });
  if (size !== undefined) {
    Object.defineProperty(file, "size", { value: size });
  }
  return file;
}

// Valid magic bytes for each format
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46];
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00];
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

// ==================== validateImageMagicBytes ====================

describe("validateImageMagicBytes", () => {
  test("detects valid JPEG magic bytes", () => {
    const buffer = new Uint8Array(JPEG_BYTES).buffer;
    expect(validateImageMagicBytes(buffer)).toBe("jpeg");
  });

  test("detects valid PNG magic bytes", () => {
    const buffer = new Uint8Array(PNG_BYTES).buffer;
    expect(validateImageMagicBytes(buffer)).toBe("png");
  });

  test("detects valid GIF magic bytes", () => {
    const buffer = new Uint8Array(GIF_BYTES).buffer;
    expect(validateImageMagicBytes(buffer)).toBe("gif");
  });

  test("detects valid WebP magic bytes", () => {
    const buffer = new Uint8Array(WEBP_BYTES).buffer;
    expect(validateImageMagicBytes(buffer)).toBe("webp");
  });

  test("rejects invalid magic bytes", () => {
    const buffer = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]).buffer;
    expect(validateImageMagicBytes(buffer)).toBeNull();
  });

  test("rejects buffer too short", () => {
    const buffer = new Uint8Array([0xff, 0xd8]).buffer;
    expect(validateImageMagicBytes(buffer)).toBeNull();
  });

  test("rejects PDF magic bytes", () => {
    // %PDF
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]).buffer;
    expect(validateImageMagicBytes(buffer)).toBeNull();
  });
});

// ==================== validateImageFile ====================

describe("validateImageFile", () => {
  test("accepts valid JPEG file", async () => {
    const file = createMockFile(JPEG_BYTES, "photo.jpg", "image/jpeg");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("jpeg");
  });

  test("accepts valid PNG file", async () => {
    const file = createMockFile(PNG_BYTES, "image.png", "image/png");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("png");
  });

  test("accepts valid GIF file", async () => {
    const file = createMockFile(GIF_BYTES, "anim.gif", "image/gif");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("gif");
  });

  test("accepts valid WebP file", async () => {
    const file = createMockFile(WEBP_BYTES, "photo.webp", "image/webp");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("webp");
  });

  test("rejects oversized file", async () => {
    const file = createMockFile(JPEG_BYTES, "big.jpg", "image/jpeg", 10 * 1024 * 1024);
    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File size must be less than");
  });

  test("rejects wrong MIME type", async () => {
    const file = createMockFile(JPEG_BYTES, "photo.jpg", "application/pdf");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Only JPEG, PNG, GIF, and WebP");
  });

  test("rejects wrong extension", async () => {
    const file = createMockFile(JPEG_BYTES, "photo.exe", "image/jpeg");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid file extension");
  });

  test("rejects file with wrong magic bytes despite correct MIME and extension", async () => {
    // PDF magic bytes but named .jpg with image/jpeg MIME
    const pdfBytes = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34];
    const file = createMockFile(pdfBytes, "sneaky.jpg", "image/jpeg");
    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match a valid image format");
  });

  test("respects custom max size", async () => {
    const file = createMockFile(JPEG_BYTES, "photo.jpg", "image/jpeg", 2000);
    const result = await validateImageFile(file, 1000);
    expect(result.valid).toBe(false);
  });
});

// ==================== isAllowedImageMimeType ====================

describe("isAllowedImageMimeType", () => {
  test("accepts image/jpeg", () => {
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
  });

  test("accepts image/png", () => {
    expect(isAllowedImageMimeType("image/png")).toBe(true);
  });

  test("accepts image/gif", () => {
    expect(isAllowedImageMimeType("image/gif")).toBe(true);
  });

  test("accepts image/webp", () => {
    expect(isAllowedImageMimeType("image/webp")).toBe(true);
  });

  test("rejects application/pdf", () => {
    expect(isAllowedImageMimeType("application/pdf")).toBe(false);
  });

  test("rejects image/svg+xml", () => {
    expect(isAllowedImageMimeType("image/svg+xml")).toBe(false);
  });

  test("rejects text/plain", () => {
    expect(isAllowedImageMimeType("text/plain")).toBe(false);
  });
});

// ==================== isAllowedImageExtension ====================

describe("isAllowedImageExtension", () => {
  test("accepts .jpg", () => {
    expect(isAllowedImageExtension("photo.jpg")).toBe(true);
  });

  test("accepts .jpeg", () => {
    expect(isAllowedImageExtension("photo.jpeg")).toBe(true);
  });

  test("accepts .png", () => {
    expect(isAllowedImageExtension("image.png")).toBe(true);
  });

  test("accepts .gif", () => {
    expect(isAllowedImageExtension("anim.gif")).toBe(true);
  });

  test("accepts .webp", () => {
    expect(isAllowedImageExtension("photo.webp")).toBe(true);
  });

  test("rejects .exe", () => {
    expect(isAllowedImageExtension("virus.exe")).toBe(false);
  });

  test("rejects .pdf", () => {
    expect(isAllowedImageExtension("doc.pdf")).toBe(false);
  });

  test("rejects .svg", () => {
    expect(isAllowedImageExtension("icon.svg")).toBe(false);
  });
});

// ==================== generateSecureFilename ====================

describe("generateSecureFilename", () => {
  test("produces filename with correct format", () => {
    const filename = generateSecureFilename(42, "photo.jpg", "listing");
    expect(filename).toMatch(/^listing-42-\d+-[a-f0-9]{16}\.jpg$/);
  });

  test("includes user ID", () => {
    const filename = generateSecureFilename(123, "image.png");
    expect(filename).toContain("123-");
  });

  test("includes prefix when provided", () => {
    const filename = generateSecureFilename(1, "a.jpg", "listing");
    expect(filename.startsWith("listing-")).toBe(true);
  });

  test("works without prefix", () => {
    const filename = generateSecureFilename(1, "a.jpg");
    expect(filename).toMatch(/^1-\d+-[a-f0-9]{16}\.jpg$/);
  });

  test("preserves original extension", () => {
    const filename = generateSecureFilename(1, "photo.png", "listing");
    expect(filename.endsWith(".png")).toBe(true);
  });

  test("generates unique filenames", () => {
    const a = generateSecureFilename(1, "a.jpg");
    const b = generateSecureFilename(1, "a.jpg");
    expect(a).not.toBe(b);
  });
});

// ==================== getFileExtension ====================

describe("getFileExtension", () => {
  test("extracts jpg extension", () => {
    expect(getFileExtension("photo.jpg")).toBe("jpg");
  });

  test("extracts png extension", () => {
    expect(getFileExtension("image.PNG")).toBe("png");
  });

  test("handles multiple dots", () => {
    expect(getFileExtension("my.file.name.jpeg")).toBe("jpeg");
  });

  test("returns bin for no extension", () => {
    expect(getFileExtension("noext")).toBe("bin");
  });
});

// ==================== sanitizeFilename ====================

describe("sanitizeFilename", () => {
  test("removes path separators", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("etcpasswd");
  });

  test("removes backslash separators", () => {
    expect(sanitizeFilename("..\\..\\windows\\system32")).toBe("windowssystem32");
  });

  test("removes null bytes", () => {
    expect(sanitizeFilename("file\0name.jpg")).toBe("filename.jpg");
  });

  test("keeps valid filenames intact", () => {
    expect(sanitizeFilename("photo-123.jpg")).toBe("photo-123.jpg");
  });
});
