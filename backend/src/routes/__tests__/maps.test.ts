import { describe, expect, test, beforeAll, afterAll, mock, spyOn } from "bun:test";
import { Router } from "../../utils/router";

// Store original env
const originalEnv = { ...process.env };

// Mock fetch for Google API calls
const mockFetch = mock((url: string | URL | Request, init?: RequestInit) =>
  Promise.resolve({
    json: () => Promise.resolve({ status: "OK", predictions: [] }),
  } as Response)
);

// Store reference to original fetch
const originalFetch = globalThis.fetch;

describe("maps routes", () => {
  let registerMapsRoutes: (router: Router) => void;

  beforeAll(async () => {
    // Set up environment
    process.env.GOOGLE_MAPS_API_KEY = "test-api-key";

    // Mock global fetch
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    // Import after env is set
    const mapsModule = await import("../maps");
    registerMapsRoutes = mapsModule.registerMapsRoutes;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  function createRouter() {
    const router = new Router();
    registerMapsRoutes(router);
    return router;
  }

  async function makeRequest(
    router: Router,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown }> {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const response = await router.handle(req);
    if (!response) {
      return { status: 404, data: { error: "Not found" } };
    }
    const data = await response.json();
    return { status: response.status, data };
  }

  describe("POST /api/v1/maps/autocomplete", () => {
    test("returns predictions from Google API", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "OK",
              predictions: [
                {
                  place_id: "place123",
                  description: "123 Test Street, Singapore",
                  structured_formatting: {
                    main_text: "123 Test Street",
                    secondary_text: "Singapore",
                  },
                },
              ],
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "123 Test",
      });

      expect(res.status).toBe(200);
      const data = res.data as { predictions: Array<{ placeId: string; description: string }> };
      expect(data.predictions.length).toBe(1);
      expect(data.predictions[0].placeId).toBe("place123");
      expect(data.predictions[0].description).toBe("123 Test Street, Singapore");
    });

    test("transforms Google response to simplified format", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "OK",
              predictions: [
                {
                  place_id: "abc123",
                  description: "Full Address Here",
                  structured_formatting: {
                    main_text: "Main Text",
                    secondary_text: "Secondary Text",
                  },
                },
              ],
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "test query",
      });

      const data = res.data as { predictions: Array<{ mainText: string; secondaryText: string }> };
      expect(data.predictions[0].mainText).toBe("Main Text");
      expect(data.predictions[0].secondaryText).toBe("Secondary Text");
    });

    test("returns empty predictions for ZERO_RESULTS", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "ZERO_RESULTS",
              predictions: [],
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "xyz nonexistent place",
      });

      expect(res.status).toBe(200);
      const data = res.data as { predictions: unknown[] };
      expect(data.predictions).toEqual([]);
    });

    test("returns 400 for missing query", async () => {
      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {});

      expect(res.status).toBe(400);
    });

    test("returns 400 for empty query", async () => {
      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "",
      });

      expect(res.status).toBe(400);
    });

    test("uses default country code sg", async () => {
      let capturedUrl = "";
      mockFetch.mockImplementation((url) => {
        capturedUrl = url.toString();
        return Promise.resolve({
          json: () => Promise.resolve({ status: "OK", predictions: [] }),
        } as Response);
      });

      const router = createRouter();
      await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "test",
      });

      // URL encoding changes : to %3A
      expect(capturedUrl).toContain("country%3Asg");
    });

    test("uses custom country code when provided", async () => {
      let capturedUrl = "";
      mockFetch.mockImplementation((url) => {
        capturedUrl = url.toString();
        return Promise.resolve({
          json: () => Promise.resolve({ status: "OK", predictions: [] }),
        } as Response);
      });

      const router = createRouter();
      await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "test",
        country: "my",
      });

      // URL encoding changes : to %3A
      expect(capturedUrl).toContain("country%3Amy");
    });

    test("returns 502 for Google API error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "REQUEST_DENIED",
              error_message: "API key invalid",
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "test",
      });

      expect(res.status).toBe(502);
      expect((res.data as { error: string }).error).toBe("API key invalid");
    });

    test("includes API key in request", async () => {
      let capturedUrl = "";
      mockFetch.mockImplementation((url) => {
        capturedUrl = url.toString();
        return Promise.resolve({
          json: () => Promise.resolve({ status: "OK", predictions: [] }),
        } as Response);
      });

      const router = createRouter();
      await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "test",
      });

      // URL should contain the API key
      expect(capturedUrl).toContain("key=");
    });
  });

  describe("POST /api/v1/maps/place-details", () => {
    test("returns place details from Google API", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "OK",
              result: {
                formatted_address: "123 Test St, Singapore 123456",
                geometry: {
                  location: {
                    lat: 1.3521,
                    lng: 103.8198,
                  },
                },
              },
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/place-details", {
        placeId: "ChIJtest123",
      });

      expect(res.status).toBe(200);
      const data = res.data as { address: string; latitude: number; longitude: number };
      expect(data.address).toBe("123 Test St, Singapore 123456");
      expect(data.latitude).toBe(1.3521);
      expect(data.longitude).toBe(103.8198);
    });

    test("returns 400 for missing placeId", async () => {
      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/place-details", {});

      expect(res.status).toBe(400);
    });

    test("returns 400 for empty placeId", async () => {
      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/place-details", {
        placeId: "",
      });

      expect(res.status).toBe(400);
    });

    test("returns 404 when place not found", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "OK",
              result: null,
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/place-details", {
        placeId: "invalid-place-id",
      });

      expect(res.status).toBe(404);
      expect((res.data as { error: string }).error).toBe("Place not found");
    });

    test("returns 502 for Google API error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "INVALID_REQUEST",
              error_message: "Invalid place ID",
            }),
        } as Response)
      );

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/place-details", {
        placeId: "bad-id",
      });

      expect(res.status).toBe(502);
      expect((res.data as { error: string }).error).toBe("Invalid place ID");
    });

    test("requests geometry and formatted_address fields", async () => {
      let capturedUrl = "";
      mockFetch.mockImplementation((url) => {
        capturedUrl = url.toString();
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              status: "OK",
              result: {
                formatted_address: "Test",
                geometry: { location: { lat: 0, lng: 0 } },
              },
            }),
        } as Response);
      });

      const router = createRouter();
      await makeRequest(router, "POST", "/api/v1/maps/place-details", {
        placeId: "test123",
      });

      // URL encoding changes , to %2C
      expect(capturedUrl).toContain("fields=geometry%2Cformatted_address");
    });
  });

  describe("API key configuration", () => {
    test("handles fetch errors gracefully", async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error("Network error")));

      const router = createRouter();
      const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
        query: "test",
      });

      expect(res.status).toBe(500);
    });
  });
});

// Test without API key configured
describe("maps routes without API key", () => {
  let registerMapsRoutes: (router: Router) => void;

  beforeAll(async () => {
    // Clear API key
    delete process.env.GOOGLE_MAPS_API_KEY;

    // Need to re-import the module to get new env value
    // Clear module cache by importing with timestamp
    const mapsModule = await import(`../maps?t=${Date.now()}`);
    registerMapsRoutes = mapsModule.registerMapsRoutes;
  });

  afterAll(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-api-key";
  });

  function createRouter() {
    const router = new Router();
    registerMapsRoutes(router);
    return router;
  }

  async function makeRequest(
    router: Router,
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ status: number; data: unknown }> {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const response = await router.handle(req);
    if (!response) {
      return { status: 404, data: { error: "Not found" } };
    }
    const data = await response.json();
    return { status: response.status, data };
  }

  test("autocomplete returns 500 when API key not configured", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/maps/autocomplete", {
      query: "test",
    });

    expect(res.status).toBe(500);
    expect((res.data as { error: string }).error).toBe("Google Maps API key not configured");
  });

  test("place-details returns 500 when API key not configured", async () => {
    const router = createRouter();
    const res = await makeRequest(router, "POST", "/api/v1/maps/place-details", {
      placeId: "test123",
    });

    expect(res.status).toBe(500);
    expect((res.data as { error: string }).error).toBe("Google Maps API key not configured");
  });
});
