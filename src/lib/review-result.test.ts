import { describe, expect, it } from "vitest";
import { applyReviewResult } from "@/lib/review-result";

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
    const result = applyReviewResult(visits, ["d1"], [{ id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT }]);

    expect(result.visits).toEqual([
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
    expect(result.visits[0].deviations[1]).toBe(visits[0].deviations[1]);
  });

  it("does not mutate the visits it was given", () => {
    const visits = makeVisits();
    applyReviewResult(
      visits,
      ["d1", "d3"],
      [
        { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
        { id: "d3", status: "unreviewed", reviewed_at: null },
      ],
    );

    expect(visits).toEqual(makeVisits());
  });

  it("applies an unmark (status back to unreviewed, reviewed_at null)", () => {
    const result = applyReviewResult(makeVisits(), ["d3"], [{ id: "d3", status: "unreviewed", reviewed_at: null }]);

    expect(result.visits[1].deviations[0]).toEqual({
      id: "d3",
      rule: "route_deviation",
      status: "unreviewed",
      reviewed_at: null,
    });
    expect(result.visits[0]).toEqual(makeVisits()[0]);
    expect(result.partial).toBe(false);
  });

  it("is not partial when every requested id came back", () => {
    const result = applyReviewResult(
      makeVisits(),
      ["d1", "d2"],
      [
        { id: "d2", status: "reviewed", reviewed_at: REVIEWED_AT },
        { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
      ],
    );

    expect(result.partial).toBe(false);
    expect(result.visits[0].deviations.map((d) => d.status)).toEqual(["reviewed", "reviewed"]);
  });

  it("is partial when one requested id out of several is missing, and leaves that row unchanged", () => {
    const result = applyReviewResult(
      makeVisits(),
      ["d1", "d2", "d3"],
      [
        { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
        { id: "d3", status: "reviewed", reviewed_at: REVIEWED_AT },
      ],
    );

    expect(result.partial).toBe(true);
    expect(result.visits[0].deviations[1]).toEqual(makeVisits()[0].deviations[1]);
    expect(result.visits[0].deviations[0].status).toBe("reviewed");
  });

  it("is partial when all but one requested id are missing", () => {
    const result = applyReviewResult(
      makeVisits(),
      ["d1", "d2", "d3"],
      [{ id: "d2", status: "reviewed", reviewed_at: REVIEWED_AT }],
    );

    expect(result.partial).toBe(true);
    expect(result.visits[0].deviations[0]).toEqual(makeVisits()[0].deviations[0]);
    expect(result.visits[0].deviations[1].status).toBe("reviewed");
    expect(result.visits[1]).toEqual(makeVisits()[1]);
  });

  it("is partial when nothing came back", () => {
    const result = applyReviewResult(makeVisits(), ["d1"], []);

    expect(result.partial).toBe(true);
    expect(result.visits).toEqual(makeVisits());
  });

  it("ignores a returned id that was not requested and is not in the visits", () => {
    const result = applyReviewResult(
      makeVisits(),
      ["d1"],
      [
        { id: "d1", status: "reviewed", reviewed_at: REVIEWED_AT },
        { id: "foreign", status: "reviewed", reviewed_at: REVIEWED_AT },
      ],
    );

    expect(result.partial).toBe(false);
    expect(result.visits[0].deviations[0].status).toBe("reviewed");
    expect(result.visits[0].deviations[1]).toEqual(makeVisits()[0].deviations[1]);
    expect(result.visits[1]).toEqual(makeVisits()[1]);
    expect(result.visits[2]).toEqual(makeVisits()[2]);
  });
});
