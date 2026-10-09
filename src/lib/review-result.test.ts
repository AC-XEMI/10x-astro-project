import { describe, expect, it } from "vitest";
import { applyReviewResult, isPartialReview } from "@/lib/review-result";

type Status = "reviewed" | "unreviewed";

interface Deviation {
  id: string;
  rule: string;
  status: Status;
  reviewed_at: string | null;
}

interface Visit {
  id: string;
  deviations: Deviation[];
}

const REVIEWED_AT = "2026-10-09T10:00:00.000Z";

// Fresh data per call, so no test can see another's mutation.
function makeVisits(): Visit[] {
  return [
    {
      id: "v1",
      deviations: [
        { id: "d1", rule: "missing_gps", status: "unreviewed", reviewed_at: null },
        { id: "d2", rule: "phone_instead_of_visit", status: "unreviewed", reviewed_at: null },
      ],
    },
    {
      id: "v2",
      deviations: [{ id: "d3", rule: "route_deviation", status: "reviewed", reviewed_at: "2026-10-01T08:00:00.000Z" }],
    },
    { id: "v3", deviations: [] },
  ];
}

describe("applyReviewResult", () => {
  it("replaces status and reviewed_at only on the rows that came back", () => {
    const visits = makeVisits();
    const result = applyReviewResult(visits, [{ id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT }]);

    expect(result).toEqual([
      {
        id: "v1",
        deviations: [
          { id: "d1", rule: "missing_gps", status: "reviewed", reviewed_at: REVIEWED_AT },
          { id: "d2", rule: "phone_instead_of_visit", status: "unreviewed", reviewed_at: null },
        ],
      },
      makeVisits()[1],
      makeVisits()[2],
    ]);
    // The neighbour on the same visit is the same object, untouched.
    expect(result[0].deviations[1]).toBe(visits[0].deviations[1]);
  });

  it("does not mutate the visits it was given", () => {
    const visits = makeVisits();
    applyReviewResult(visits, [
      { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
      { id: "d3", status: "unreviewed", reviewed_at: null },
    ]);

    expect(visits).toEqual(makeVisits());
  });

  it("applies an unmark (status back to unreviewed, reviewed_at null)", () => {
    const result = applyReviewResult(makeVisits(), [{ id: "d3", status: "unreviewed", reviewed_at: null }]);

    expect(result[1].deviations[0]).toEqual({
      id: "d3",
      rule: "route_deviation",
      status: "unreviewed",
      reviewed_at: null,
    });
    expect(result[0]).toEqual(makeVisits()[0]);
  });

  it("leaves a requested row that did not come back unchanged", () => {
    // d2 was requested but the endpoint did not return it (RLS-hidden or deleted).
    const result = applyReviewResult(makeVisits(), [
      { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
      { id: "d3", status: "reviewed", reviewed_at: REVIEWED_AT },
    ]);

    expect(result[0].deviations[0].status).toBe("reviewed");
    expect(result[0].deviations[1]).toEqual(makeVisits()[0].deviations[1]);
  });

  it("ignores a returned id that is not in the visits", () => {
    const result = applyReviewResult(makeVisits(), [
      { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
      { id: "foreign", status: "reviewed", reviewed_at: REVIEWED_AT },
    ]);

    expect(result[0].deviations[0].status).toBe("reviewed");
    expect(result[0].deviations[1]).toEqual(makeVisits()[0].deviations[1]);
    expect(result[1]).toEqual(makeVisits()[1]);
    expect(result[2]).toEqual(makeVisits()[2]);
  });
});

describe("isPartialReview", () => {
  it("is not partial when every requested id came back, in any order", () => {
    expect(isPartialReview(["d1", "d2"], [{ id: "d2" }, { id: "d1" }])).toBe(false);
  });

  it("is partial when one requested id out of several is missing", () => {
    expect(isPartialReview(["d1", "d2", "d3"], [{ id: "d1" }, { id: "d3" }])).toBe(true);
  });

  it("is partial when all but one requested id are missing", () => {
    expect(isPartialReview(["d1", "d2", "d3"], [{ id: "d2" }])).toBe(true);
  });

  it("is partial when nothing came back", () => {
    expect(isPartialReview(["d1"], [])).toBe(true);
  });

  it("is not partial when an extra, unrequested id came back", () => {
    expect(isPartialReview(["d1"], [{ id: "d1" }, { id: "foreign" }])).toBe(false);
  });

  it("is not partial when a requested id is repeated and came back once", () => {
    expect(isPartialReview(["d1", "d1"], [{ id: "d1" }])).toBe(false);
  });
});
