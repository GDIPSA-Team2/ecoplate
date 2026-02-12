import { describe, expect, test } from "bun:test";
import {
  generateSecureRandom,
  generateSecureFilename,
  getFileExtension,
  isAllowedImageExtension,
  isAllowedImageMimeType,
  validateImageMagicBytes,
  validateImageFile,
  sanitizeFilename,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_EXTENSIONS,
} from "../file-utils";

describe("generateSecureRandom", () => {
  test("generates random string of default length", () => {
    const result = generateSecureRandom();
    expect(result).toBeDefined();
    expect(typeof result).toBe("string");
    expect(result.length).toBe(32); // 16 bytes = 32 hex chars
  });

  test("generates random string of specified length", () => {
    const result = generateSecureRandom(8);
    expect(result.length).toBe(16); // 8 bytes = 16 hex chars
  });

  test("generates unique values", () => {
    const result1 = generateSecureRandom();
    const result2 = generateSecureRandom();
    expect(result1).not.toBe(result2);
  });

  test("generates only hex characters", () => {
    const result = generateSecureRandom();
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

describe("generateSecureFilename", () => {
  test("generates filename with user ID, timestamp, and extension", () => {
    const result = generateSecureFilename(123, "photo.jpg");
    expect(result).toMatch(/^123-\d+-[0-9a-f]+\.jpg$/);
  });

  test("generates filename with prefix", () => {
    const result = generateSecureFilename(456, "image.png", "listing");
    expect(result).toMatch(/^listing-456-\d+-[0-9a-f]+\.png$/);
  });

  test("handles uppercase extensions", () => {
    const result = generateSecureFilename(789, "PHOTO.JPG");
    expect(result).toMatch(/\.jpg$/);
  });

  test("generates unique filenames", () => {
    const result1 = generateSecureFilename(1, "test.jpg");
    const result2 = generateSecureFilename(1, "test.jpg");
    expect(result1).not.toBe(result2);
  });

  test("handles files without extension", () => {
    const result = generateSecureFilename(1, "noextension");
    expect(result).toMatch(/\.bin$/);
  });
});

describe("getFileExtension", () => {
  test("extracts extension from filename", () => {
    expect(getFileExtension("photo.jpg")).toBe("jpg");
    expect(getFileExtension("image.png")).toBe("png");
    expect(getFileExtension("document.pdf")).toBe("pdf");
  });

  test("handles multiple dots in filename", () => {
    expect(getFileExtension("my.photo.jpg")).toBe("jpg");
    expect(getFileExtension("file.name.with.dots.png")).toBe("png");
  });

  test("converts extension to lowercase", () => {
    expect(getFileExtension("PHOTO.JPG")).toBe("jpg");
    expect(getFileExtension("Image.PNG")).toBe("png");
  });

  test("returns bin for files without extension", () => {
    expect(getFileExtension("noextension")).toBe("bin");
  });

  test("handles dot at end of filename", () => {
    expect(getFileExtension("file.")).toBe("");
  });
});

describe("isAllowedImageExtension", () => {
  test("accepts valid image extensions", () => {
    expect(isAllowedImageExtension("photo.jpg")).toBe(true);
    expect(isAllowedImageExtension("photo.jpeg")).toBe(true);
    expect(isAllowedImageExtension("image.png")).toBe(true);
    expect(isAllowedImageExtension("image.gif")).toBe(true);
    expect(isAllowedImageExtension("image.webp")).toBe(true);
  });

  test("accepts uppercase extensions", () => {
    expect(isAllowedImageExtension("photo.JPG")).toBe(true);
    expect(isAllowedImageExtension("image.PNG")).toBe(true);
  });

  test("rejects non-image extensions", () => {
    expect(isAllowedImageExtension("document.pdf")).toBe(false);
    expect(isAllowedImageExtension("script.js")).toBe(false);
    expect(isAllowedImageExtension("data.json")).toBe(false);
    expect(isAllowedImageExtension("program.exe")).toBe(false);
  });

  test("rejects files without extension", () => {
    expect(isAllowedImageExtension("noextension")).toBe(false);
  });
});

describe("isAllowedImageMimeType", () => {
  test("accepts valid image MIME types", () => {
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
    expect(isAllowedImageMimeType("image/png")).toBe(true);
    expect(isAllowedImageMimeType("image/gif")).toBe(true);
    expect(isAllowedImageMimeType("image/webp")).toBe(true);
  });

  test("rejects non-image MIME types", () => {
    expect(isAllowedImageMimeType("application/pdf")).toBe(false);
    expect(isAllowedImageMimeType("text/plain")).toBe(false);
    expect(isAllowedImageMimeType("application/javascript")).toBe(false);
  });

  test("rejects unsupported image MIME types", () => {
    expect(isAllowedImageMimeType("image/bmp")).toBe(false);
    expect(isAllowedImageMimeType("image/tiff")).toBe(false);
    expect(isAllowedImageMimeType("image/svg+xml")).toBe(false);
  });
});

describe("validateImageMagicBytes", () => {
  test("detects JPEG files", () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00]);
    const result = validateImageMagicBytes(jpegBytes.buffer);
    expect(result).toBe("jpeg");
  });

  test("detects PNG files", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const result = validateImageMagicBytes(pngBytes.buffer);
    expect(result).toBe("png");
  });

  test("detects GIF files", () => {
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const result = validateImageMagicBytes(gifBytes.buffer);
    expect(result).toBe("gif");
  });

  test("detects WebP files", () => {
    // RIFF....WEBP header
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size placeholder
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    const result = validateImageMagicBytes(webpBytes.buffer);
    expect(result).toBe("webp");
  });

  test("returns null for unknown format", () => {
    const unknownBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const result = validateImageMagicBytes(unknownBytes.buffer);
    expect(result).toBeNull();
  });

  test("returns null for empty buffer", () => {
    const emptyBytes = new Uint8Array([]);
    const result = validateImageMagicBytes(emptyBytes.buffer);
    expect(result).toBeNull();
  });

  test("returns null for buffer too small", () => {
    const smallBytes = new Uint8Array([0xff, 0xd8]);
    const result = validateImageMagicBytes(smallBytes.buffer);
    expect(result).toBeNull();
  });
});

describe("validateImageFile", () => {
  test("rejects file exceeding max size", async () => {
    // Create a mock File object larger than 1KB
    const largeContent = new Uint8Array(2000).fill(0);
    const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });

    const result = await validateImageFile(file, 1024); // 1KB max
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File size");
  });

  test("rejects invalid MIME type", async () => {
    const content = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([content], "test.txt", { type: "text/plain" });

    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("JPEG, PNG, GIF, and WebP");
  });

  test("rejects invalid extension", async () => {
    const content = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([content], "test.pdf", { type: "image/jpeg" });

    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("extension");
  });

  test("rejects file with mismatched magic bytes", async () => {
    // PDF header disguised as JPEG
    const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const file = new File([pdfContent], "fake.jpg", { type: "image/jpeg" });

    const result = await validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match");
  });

  test("accepts valid JPEG file", async () => {
    const jpegContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const file = new File([jpegContent], "valid.jpg", { type: "image/jpeg" });

    const result = await validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("jpeg");
  });

  test("accepts valid PNG file", async () => {
    const pngContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const file = new File([pngContent], "valid.png", { type: "image/png" });

    const result = await validateImageFile(file);
    expect(result.valid).toBe(true);
    expect(result.detectedType).toBe("png");
  });
});

describe("sanitizeFilename", () => {
  test("removes forward slashes", () => {
    expect(sanitizeFilename("path/to/file.jpg")).toBe("pathtofile.jpg");
  });

  test("removes backslashes", () => {
    expect(sanitizeFilename("path\\to\\file.jpg")).toBe("pathtofile.jpg");
  });

  test("removes null bytes", () => {
    expect(sanitizeFilename("file\x00name.jpg")).toBe("filename.jpg");
  });

  test("removes double dots (directory traversal)", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("etcpasswd");
  });

  test("handles combination of dangerous characters", () => {
    expect(sanitizeFilename("../path\\to/file\x00.jpg")).toBe("pathtofile.jpg");
  });

  test("preserves normal filenames", () => {
    expect(sanitizeFilename("normal_filename.jpg")).toBe("normal_filename.jpg");
    expect(sanitizeFilename("photo-2024.png")).toBe("photo-2024.png");
  });
});

describe("constants", () => {
  test("ALLOWED_IMAGE_TYPES contains expected values", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/gif");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/webp");
  });

  test("ALLOWED_IMAGE_EXTENSIONS contains expected values", () => {
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain("jpg");
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain("jpeg");
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain("png");
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain("gif");
    expect(ALLOWED_IMAGE_EXTENSIONS).toContain("webp");
  });
});
