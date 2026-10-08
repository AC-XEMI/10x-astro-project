import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "@/lib/services/geo";

const WARSAW = { lat: 52.2297, lng: 21.0122 };
const KRAKOW = { lat: 50.0647, lng: 19.945 };

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm(WARSAW, WARSAW)).toBe(0);
  });

  it("is symmetric", () => {
    expect(haversineDistanceKm(WARSAW, KRAKOW)).toBeCloseTo(haversineDistanceKm(KRAKOW, WARSAW), 10);
  });

  it("matches the known Warsaw-Krakow great-circle distance (~252 km)", () => {
    expect(haversineDistanceKm(WARSAW, KRAKOW)).toBeCloseTo(252.0, 0);
  });

  // Large distances keep the formula honest: for short hops sqrt(1 - h) and sqrt(1 + h) differ by
  // less than any sensible tolerance, so only a long arc catches a sign slip there.
  it("measures a quarter of the equator as a quarter of the circumference", () => {
    expect(haversineDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 90 })).toBeCloseTo((Math.PI * 6371) / 2, 3);
  });

  it("measures one degree of latitude along a meridian as ~111.2 km", () => {
    expect(haversineDistanceKm({ lat: 50, lng: 20 }, { lat: 51, lng: 20 })).toBeCloseTo(111.19, 1);
  });
});
