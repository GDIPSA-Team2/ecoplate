import { describe, expect, test } from "bun:test";
import {
  calculateDistance,
  parseCoordinates,
  isValidSingaporeCoordinates,
  formatCoordinates,
  type Coordinates,
} from "../distance";

describe("calculateDistance", () => {
  test("calculates distance between two points correctly", () => {
    // Distance between Singapore (1.3521, 103.8198) and Kuala Lumpur (3.1390, 101.6869)
    // Should be approximately 315 km
    const singapore: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
    const kualaLumpur: Coordinates = { latitude: 3.139, longitude: 101.6869 };

    const distance = calculateDistance(singapore, kualaLumpur);
    expect(distance).toBeGreaterThan(300);
    expect(distance).toBeLessThan(330);
  });

  test("returns 0 for same coordinates", () => {
    const point: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
    const distance = calculateDistance(point, point);
    expect(distance).toBe(0);
  });

  test("calculates short distances accurately", () => {
    // Two points about 1km apart in Singapore
    const point1: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
    const point2: Coordinates = { latitude: 1.3611, longitude: 103.8198 };

    const distance = calculateDistance(point1, point2);
    expect(distance).toBeGreaterThan(0.9);
    expect(distance).toBeLessThan(1.1);
  });

  test("handles negative latitudes", () => {
    // Singapore to Sydney
    const singapore: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
    const sydney: Coordinates = { latitude: -33.8688, longitude: 151.2093 };

    const distance = calculateDistance(singapore, sydney);
    expect(distance).toBeGreaterThan(6000);
    expect(distance).toBeLessThan(7000);
  });

  test("handles crossing international date line", () => {
    // Points on opposite sides of the date line
    const point1: Coordinates = { latitude: 0, longitude: 179 };
    const point2: Coordinates = { latitude: 0, longitude: -179 };

    const distance = calculateDistance(point1, point2);
    // Should be approximately 222 km (2 degrees at equator)
    expect(distance).toBeGreaterThan(200);
    expect(distance).toBeLessThan(250);
  });

  test("handles equator to pole distance", () => {
    const equator: Coordinates = { latitude: 0, longitude: 0 };
    const northPole: Coordinates = { latitude: 90, longitude: 0 };

    const distance = calculateDistance(equator, northPole);
    // Quarter of Earth's circumference, approximately 10,000 km
    expect(distance).toBeGreaterThan(9900);
    expect(distance).toBeLessThan(10100);
  });
});

describe("parseCoordinates", () => {
  test("parses simple lat,lng format", () => {
    const result = parseCoordinates("1.3521,103.8198");
    expect(result).not.toBeNull();
    expect(result?.latitude).toBe(1.3521);
    expect(result?.longitude).toBe(103.8198);
  });

  test("parses address|lat,lng format", () => {
    const result = parseCoordinates("123 Main Street, Singapore|1.3521,103.8198");
    expect(result).not.toBeNull();
    expect(result?.latitude).toBe(1.3521);
    expect(result?.longitude).toBe(103.8198);
  });

  test("parses negative coordinates", () => {
    const result = parseCoordinates("-33.8688,151.2093");
    expect(result).not.toBeNull();
    expect(result?.latitude).toBe(-33.8688);
    expect(result?.longitude).toBe(151.2093);
  });

  test("parses coordinates with spaces", () => {
    const result = parseCoordinates("1.3521, 103.8198");
    expect(result).not.toBeNull();
    expect(result?.latitude).toBe(1.3521);
    expect(result?.longitude).toBe(103.8198);
  });

  test("returns null for null input", () => {
    const result = parseCoordinates(null);
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = parseCoordinates("");
    expect(result).toBeNull();
  });

  test("returns null for invalid format", () => {
    const result = parseCoordinates("not coordinates");
    expect(result).toBeNull();
  });

  test("returns null for incomplete coordinates", () => {
    const result = parseCoordinates("1.3521");
    expect(result).toBeNull();
  });

  test("handles address with pipe character correctly", () => {
    const result = parseCoordinates("Block 123|Orchard Road|1.3000,103.8000");
    // Should extract last part as coordinates
    expect(result).toBeNull(); // Format doesn't match expected pattern
  });
});

describe("isValidSingaporeCoordinates", () => {
  test("returns true for valid Singapore coordinates", () => {
    const coord: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
    expect(isValidSingaporeCoordinates(coord)).toBe(true);
  });

  test("returns true for Singapore boundary coordinates", () => {
    // Test minimum bounds
    const minCoord: Coordinates = { latitude: 1.15, longitude: 103.6 };
    expect(isValidSingaporeCoordinates(minCoord)).toBe(true);

    // Test maximum bounds
    const maxCoord: Coordinates = { latitude: 1.48, longitude: 104.1 };
    expect(isValidSingaporeCoordinates(maxCoord)).toBe(true);
  });

  test("returns false for coordinates outside Singapore", () => {
    // Kuala Lumpur
    const klCoord: Coordinates = { latitude: 3.139, longitude: 101.6869 };
    expect(isValidSingaporeCoordinates(klCoord)).toBe(false);
  });

  test("returns false for latitude too low", () => {
    const coord: Coordinates = { latitude: 1.1, longitude: 103.8 };
    expect(isValidSingaporeCoordinates(coord)).toBe(false);
  });

  test("returns false for latitude too high", () => {
    const coord: Coordinates = { latitude: 1.5, longitude: 103.8 };
    expect(isValidSingaporeCoordinates(coord)).toBe(false);
  });

  test("returns false for longitude too low", () => {
    const coord: Coordinates = { latitude: 1.3, longitude: 103.5 };
    expect(isValidSingaporeCoordinates(coord)).toBe(false);
  });

  test("returns false for longitude too high", () => {
    const coord: Coordinates = { latitude: 1.3, longitude: 104.2 };
    expect(isValidSingaporeCoordinates(coord)).toBe(false);
  });
});

describe("formatCoordinates", () => {
  test("formats coordinates correctly", () => {
    const coord: Coordinates = { latitude: 1.3521, longitude: 103.8198 };
    const result = formatCoordinates(coord);
    expect(result).toBe("1.3521,103.8198");
  });

  test("formats negative coordinates correctly", () => {
    const coord: Coordinates = { latitude: -33.8688, longitude: 151.2093 };
    const result = formatCoordinates(coord);
    expect(result).toBe("-33.8688,151.2093");
  });

  test("formats integer coordinates correctly", () => {
    const coord: Coordinates = { latitude: 1, longitude: 103 };
    const result = formatCoordinates(coord);
    expect(result).toBe("1,103");
  });
});
