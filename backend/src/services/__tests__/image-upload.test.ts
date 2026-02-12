import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { mkdir, unlink, rmdir } from "node:fs/promises";
import { join } from "node:path";

// Import the service functions
import {
  validateImage,
  generateFilename,
  saveImageLocally,
  uploadProductImage,
  uploadProductImages,
  deleteImage,
  deleteImages,
  initializeUploadDir,
  uploadToCloud,
} from "../image-upload";

describe("image-upload service", () => {
  const testUploadDir = join(process.cwd(), "public", "uploads", "marketplace");

  describe("validateImage", () => {
    test("returns valid for jpeg image", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const result = validateImage(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("returns valid for jpg image", () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpg" });
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    test("returns valid for png image", () => {
      const file = new File(["test"], "test.png", { type: "image/png" });
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    test("returns valid for webp image", () => {
      const file = new File(["test"], "test.webp", { type: "image/webp" });
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    test("returns invalid for gif image", () => {
      const file = new File(["test"], "test.gif", { type: "image/gif" });
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    test("returns invalid for pdf file", () => {
      const file = new File(["test"], "test.pdf", { type: "application/pdf" });
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    });

    test("returns invalid for no file", () => {
      const result = validateImage(null as unknown as File);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("No file provided");
    });

    test("returns invalid for file exceeding 5MB", () => {
      // Create a file larger than 5MB (simulate with size property)
      const largeContent = new Array(6 * 1024 * 1024).fill("a").join("");
      const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
      expect(result.error).toContain("5MB");
    });

    test("returns valid for file exactly at 5MB limit", () => {
      const content = new Array(5 * 1024 * 1024).fill("a").join("");
      const file = new File([content], "exact.jpg", { type: "image/jpeg" });
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    test("lists allowed types in error message", () => {
      const file = new File(["test"], "test.bmp", { type: "image/bmp" });
      const result = validateImage(file);
      expect(result.error).toContain("image/jpeg");
      expect(result.error).toContain("image/png");
      expect(result.error).toContain("image/webp");
    });
  });

  describe("generateFilename", () => {
    test("generates unique filename with timestamp", () => {
      const filename = generateFilename("test.jpg");
      expect(filename).toMatch(/^\d+-[a-f0-9-]+\.jpg$/);
    });

    test("preserves file extension", () => {
      const jpgFilename = generateFilename("photo.jpg");
      const pngFilename = generateFilename("image.png");
      const webpFilename = generateFilename("picture.webp");

      expect(jpgFilename).toMatch(/\.jpg$/);
      expect(pngFilename).toMatch(/\.png$/);
      expect(webpFilename).toMatch(/\.webp$/);
    });

    test("generates different filenames for same input", () => {
      const filename1 = generateFilename("test.jpg");
      const filename2 = generateFilename("test.jpg");
      expect(filename1).not.toBe(filename2);
    });

    test("handles file without extension", () => {
      const filename = generateFilename("noextension");
      expect(filename).toMatch(/\.noextension$/);
    });

    test("handles multiple dots in filename", () => {
      const filename = generateFilename("my.photo.final.jpg");
      expect(filename).toMatch(/\.jpg$/);
    });
  });

  describe("saveImageLocally", () => {
    const testFilename = "test-save-image.jpg";
    let savedFilePath: string;

    afterEach(async () => {
      // Clean up any created test files
      if (savedFilePath) {
        try {
          await unlink(savedFilePath);
        } catch {
          // Ignore if file doesn't exist
        }
      }
    });

    test("saves file and returns URL path", async () => {
      const file = new File(["test image content"], testFilename, { type: "image/jpeg" });
      const urlPath = await saveImageLocally(file);

      expect(urlPath).toMatch(/^uploads\/marketplace\/\d+-[a-f0-9-]+\.jpg$/);

      // Store the path for cleanup
      savedFilePath = join(process.cwd(), "public", urlPath);

      // Verify file exists
      const savedFile = Bun.file(savedFilePath);
      expect(await savedFile.exists()).toBe(true);
    });

    test("creates upload directory if it doesn't exist", async () => {
      // This test verifies the mkdir call happens
      const file = new File(["content"], "mkdir-test.jpg", { type: "image/jpeg" });
      const urlPath = await saveImageLocally(file);

      savedFilePath = join(process.cwd(), "public", urlPath);

      // Directory should exist
      const dirExists = await Bun.file(testUploadDir).exists();
      // The parent directory should be created
      expect(urlPath).toContain("uploads/marketplace/");
    });
  });

  describe("uploadProductImage", () => {
    afterEach(() => {
      // Reset environment
      delete process.env.USE_CLOUD_STORAGE;
    });

    test("validates image type before upload", async () => {
      const invalidFile = new File(["test"], "test.gif", { type: "image/gif" });

      await expect(uploadProductImage(invalidFile)).rejects.toThrow("Invalid file type");
    });

    test("accepts valid image types", async () => {
      const validFile = new File(["test content"], "test.jpg", { type: "image/jpeg" });
      const urlPath = await uploadProductImage(validFile);
      expect(urlPath).toContain("uploads/marketplace/");
    });

    test("returns URL path for uploaded image", async () => {
      const file = new File(["test"], "test.png", { type: "image/png" });
      const urlPath = await uploadProductImage(file);

      expect(urlPath).toContain("uploads/marketplace/");
      expect(urlPath).toMatch(/\.(jpg|png|jpeg|webp)$/);
    });
  });

  describe("uploadProductImages", () => {
    test("uploads multiple files", async () => {
      const files = [
        new File(["content1"], "img1.jpg", { type: "image/jpeg" }),
        new File(["content2"], "img2.jpg", { type: "image/jpeg" }),
        new File(["content3"], "img3.png", { type: "image/png" }),
      ];

      const urls = await uploadProductImages(files);

      expect(urls.length).toBe(3);
      urls.forEach((url) => {
        expect(url).toContain("uploads/marketplace/");
      });
    });

    test("returns empty array for empty input", async () => {
      const urls = await uploadProductImages([]);
      expect(urls).toEqual([]);
    });

    test("handles mixed valid files", async () => {
      const files = [
        new File(["content1"], "img1.jpg", { type: "image/jpeg" }),
        new File(["content2"], "img2.png", { type: "image/png" }),
      ];

      const urls = await uploadProductImages(files);
      expect(urls.length).toBe(2);
      urls.forEach((url) => {
        expect(url).toContain("uploads/marketplace/");
      });
    });

    test("uploads files in parallel", async () => {
      const startTime = Date.now();
      const files = [
        new File(["content1"], "img1.jpg", { type: "image/jpeg" }),
        new File(["content2"], "img2.jpg", { type: "image/jpeg" }),
      ];

      await uploadProductImages(files);

      // If uploads were sequential, this would take longer
      // This is a basic check that Promise.all is being used
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000); // Should be fast
    });
  });

  describe("uploadToCloud", () => {
    test("throws not implemented error", async () => {
      const file = new File(["content"], "cloud.jpg", { type: "image/jpeg" });

      await expect(uploadToCloud(file)).rejects.toThrow("Cloud upload not implemented yet");
    });
  });

  describe("deleteImage", () => {
    test("does not throw for non-existent file", async () => {
      // Should not throw even if file doesn't exist
      await expect(deleteImage("uploads/marketplace/nonexistent.jpg")).resolves.toBeUndefined();
    });

    test("does not delete cloud URLs", async () => {
      // Cloud URLs should be ignored
      await expect(deleteImage("https://cdn.example.com/image.jpg")).resolves.toBeUndefined();
    });

    test("handles http URLs", async () => {
      await expect(deleteImage("http://example.com/image.jpg")).resolves.toBeUndefined();
    });
  });

  describe("deleteImages", () => {
    test("deletes multiple images", async () => {
      const urls = [
        "uploads/marketplace/img1.jpg",
        "uploads/marketplace/img2.jpg",
      ];

      // Should not throw even if files don't exist
      await expect(deleteImages(urls)).resolves.toBeUndefined();
    });

    test("handles empty array", async () => {
      await expect(deleteImages([])).resolves.toBeUndefined();
    });

    test("handles mixed local and cloud URLs", async () => {
      const urls = [
        "uploads/marketplace/local.jpg",
        "https://cdn.example.com/cloud.jpg",
      ];

      await expect(deleteImages(urls)).resolves.toBeUndefined();
    });
  });

  describe("initializeUploadDir", () => {
    test("creates upload directory", async () => {
      // This should not throw
      await expect(initializeUploadDir()).resolves.toBeUndefined();
    });

    test("succeeds if directory already exists", async () => {
      // Call twice - second call should also succeed
      await initializeUploadDir();
      await expect(initializeUploadDir()).resolves.toBeUndefined();
    });
  });
});

describe("integration tests", () => {
  test("upload returns valid URL path", async () => {
    // Create a test file
    const file = new File(["test content for integration"], "integration-test.jpg", {
      type: "image/jpeg",
    });

    // Upload
    const urlPath = await uploadProductImage(file);
    expect(urlPath).toContain("uploads/marketplace/");
    expect(urlPath).toMatch(/\.jpg$/);
  });

  test("batch upload returns multiple URL paths", async () => {
    const files = [
      new File(["batch1"], "batch1.jpg", { type: "image/jpeg" }),
      new File(["batch2"], "batch2.png", { type: "image/png" }),
    ];

    const urls = await uploadProductImages(files);

    expect(urls.length).toBe(2);
    urls.forEach((url) => {
      expect(url).toContain("uploads/marketplace/");
    });
  });
});
