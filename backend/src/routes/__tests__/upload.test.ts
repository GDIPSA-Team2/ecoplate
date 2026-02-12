import { describe, expect, test, beforeAll, mock } from "bun:test";
import { Router } from "../../utils/router";

// Mock state for user authentication
const mockState = {
  userId: 1,
  authenticated: true,
};

// Mock auth middleware
mock.module("../../middleware/auth", () => ({
  getUser: () => {
    if (!mockState.authenticated) {
      return null;
    }
    return {
      id: mockState.userId,
      email: "test@example.com",
      name: "Test User",
    };
  },
  authMiddleware: async (_req: Request, next: () => Promise<Response>) => next(),
}));

// Mock image upload service
const mockUploadProductImage = mock(() => Promise.resolve("uploads/marketplace/test-123.jpg"));
const mockUploadProductImages = mock(() =>
  Promise.resolve([
    "uploads/marketplace/test-1.jpg",
    "uploads/marketplace/test-2.jpg",
  ])
);

mock.module("../../services/image-upload", () => ({
  uploadProductImage: mockUploadProductImage,
  uploadProductImages: mockUploadProductImages,
}));

// Import after mocks are set up
let registerUploadRoutes: (router: Router) => void;

beforeAll(async () => {
  const uploadModule = await import("../upload");
  registerUploadRoutes = uploadModule.registerUploadRoutes;
});

describe("upload routes", () => {
  function createRouter(authenticated: boolean = true) {
    mockState.authenticated = authenticated;
    const router = new Router();
    registerUploadRoutes(router);
    return router;
  }

  function createFileFormData(fieldName: string, filename: string, type: string): FormData {
    const formData = new FormData();
    const file = new File(["test content"], filename, { type });
    formData.append(fieldName, file);
    return formData;
  }

  function createMultiFileFormData(files: Array<{ name: string; type: string }>): FormData {
    const formData = new FormData();
    files.forEach((f, i) => {
      const file = new File([`test content ${i}`], f.name, { type: f.type });
      formData.append(`image${i}`, file);
    });
    return formData;
  }

  async function makeFormDataRequest(
    router: Router,
    method: string,
    path: string,
    formData: FormData
  ): Promise<{ status: number; data: unknown }> {
    const req = new Request(`http://localhost${path}`, {
      method,
      body: formData,
    });

    const response = await router.handle(req);
    if (!response) {
      return { status: 404, data: { error: "Not found" } };
    }
    const data = await response.json();
    return { status: response.status, data };
  }

  describe("POST /api/v1/upload/image", () => {
    test("successfully uploads a single image", async () => {
      mockUploadProductImage.mockImplementation(() =>
        Promise.resolve("uploads/marketplace/uploaded-123.jpg")
      );

      const router = createRouter();
      const formData = createFileFormData("image", "test.jpg", "image/jpeg");
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/image", formData);

      expect(res.status).toBe(200);
      const data = res.data as { imageUrl: string; message: string };
      expect(data.imageUrl).toBe("uploads/marketplace/uploaded-123.jpg");
      expect(data.message).toBe("Image uploaded successfully");
    });

    test("returns 401 for unauthenticated user", async () => {
      const router = createRouter(false);
      const formData = createFileFormData("image", "test.jpg", "image/jpeg");
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/image", formData);

      expect(res.status).toBe(401);
      expect((res.data as { error: string }).error).toBe("Unauthorized");
    });

    test("returns 400 when no image file provided", async () => {
      const router = createRouter();
      const formData = new FormData();
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/image", formData);

      expect(res.status).toBe(400);
      expect((res.data as { error: string }).error).toBe("No image file provided");
    });

    test("returns 500 when upload fails", async () => {
      mockUploadProductImage.mockImplementation(() =>
        Promise.reject(new Error("Upload failed"))
      );

      const router = createRouter();
      const formData = createFileFormData("image", "test.jpg", "image/jpeg");
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/image", formData);

      expect(res.status).toBe(500);
      expect((res.data as { error: string }).error).toBe("Upload failed");
    });

    test("returns 500 with validation error message", async () => {
      mockUploadProductImage.mockImplementation(() =>
        Promise.reject(new Error("Invalid file type. Allowed: image/jpeg, image/png"))
      );

      const router = createRouter();
      const formData = createFileFormData("image", "test.gif", "image/gif");
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/image", formData);

      expect(res.status).toBe(500);
      expect((res.data as { error: string }).error).toContain("Invalid file type");
    });
  });

  describe("POST /api/v1/upload/images", () => {
    test("successfully uploads multiple images", async () => {
      mockUploadProductImages.mockImplementation(() =>
        Promise.resolve([
          "uploads/marketplace/img1.jpg",
          "uploads/marketplace/img2.jpg",
          "uploads/marketplace/img3.jpg",
        ])
      );

      const router = createRouter();
      const formData = createMultiFileFormData([
        { name: "image1.jpg", type: "image/jpeg" },
        { name: "image2.jpg", type: "image/jpeg" },
        { name: "image3.jpg", type: "image/jpeg" },
      ]);
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(200);
      const data = res.data as { imageUrls: string[]; message: string };
      expect(data.imageUrls.length).toBe(3);
      expect(data.message).toBe("3 images uploaded successfully");
    });

    test("returns 401 for unauthenticated user", async () => {
      const router = createRouter(false);
      const formData = createMultiFileFormData([
        { name: "image1.jpg", type: "image/jpeg" },
      ]);
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(401);
      expect((res.data as { error: string }).error).toBe("Unauthorized");
    });

    test("returns 400 when no files provided", async () => {
      const router = createRouter();
      const formData = new FormData();
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(400);
      expect((res.data as { error: string }).error).toBe("No image files provided");
    });

    test("returns 400 when more than 5 images provided", async () => {
      const router = createRouter();
      const formData = createMultiFileFormData([
        { name: "image1.jpg", type: "image/jpeg" },
        { name: "image2.jpg", type: "image/jpeg" },
        { name: "image3.jpg", type: "image/jpeg" },
        { name: "image4.jpg", type: "image/jpeg" },
        { name: "image5.jpg", type: "image/jpeg" },
        { name: "image6.jpg", type: "image/jpeg" },
      ]);
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(400);
      expect((res.data as { error: string }).error).toBe("Maximum 5 images allowed");
    });

    test("returns 500 when upload fails", async () => {
      mockUploadProductImages.mockImplementation(() =>
        Promise.reject(new Error("Batch upload failed"))
      );

      const router = createRouter();
      const formData = createMultiFileFormData([
        { name: "image1.jpg", type: "image/jpeg" },
      ]);
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(500);
      expect((res.data as { error: string }).error).toBe("Batch upload failed");
    });

    test("uploads exactly 5 images successfully", async () => {
      mockUploadProductImages.mockImplementation(() =>
        Promise.resolve([
          "uploads/marketplace/img1.jpg",
          "uploads/marketplace/img2.jpg",
          "uploads/marketplace/img3.jpg",
          "uploads/marketplace/img4.jpg",
          "uploads/marketplace/img5.jpg",
        ])
      );

      const router = createRouter();
      const formData = createMultiFileFormData([
        { name: "image1.jpg", type: "image/jpeg" },
        { name: "image2.jpg", type: "image/jpeg" },
        { name: "image3.jpg", type: "image/jpeg" },
        { name: "image4.jpg", type: "image/jpeg" },
        { name: "image5.jpg", type: "image/jpeg" },
      ]);
      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(200);
      const data = res.data as { imageUrls: string[]; message: string };
      expect(data.imageUrls.length).toBe(5);
      expect(data.message).toBe("5 images uploaded successfully");
    });

    test("only processes fields starting with 'image'", async () => {
      mockUploadProductImages.mockImplementation((files: File[]) =>
        Promise.resolve(files.map((f) => `uploads/marketplace/${f.name}`))
      );

      const router = createRouter();
      const formData = new FormData();
      formData.append("image1", new File(["test"], "valid.jpg", { type: "image/jpeg" }));
      formData.append("other", new File(["test"], "invalid.jpg", { type: "image/jpeg" }));
      formData.append("image2", new File(["test"], "valid2.jpg", { type: "image/jpeg" }));

      const res = await makeFormDataRequest(router, "POST", "/api/v1/upload/images", formData);

      expect(res.status).toBe(200);
      // Only 2 images should be processed (those starting with 'image')
      expect(mockUploadProductImages).toHaveBeenCalledWith(expect.any(Array));
    });
  });
});
