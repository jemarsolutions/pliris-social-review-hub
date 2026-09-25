import { describe, expect, it } from "vitest";
import { formatLocalDateTime, localDateKey } from "../src/lib/date-time";

describe("local date and time formatting", () => {
  const instant = "2026-09-24T13:00:00.000Z";

  it("shows the same instant at 9 PM in the Philippines", () => {
    expect(formatLocalDateTime(instant, "Asia/Manila")).toContain("9:00 PM");
    expect(localDateKey(instant, "Asia/Manila")).toBe("2026-09-24");
  });

  it("shows the same instant on the viewer's local date", () => {
    expect(formatLocalDateTime(instant, "America/Los_Angeles")).toContain(
      "6:00 AM",
    );
    expect(localDateKey(instant, "America/Los_Angeles")).toBe("2026-09-24");
  });

  it("moves calendar grouping when the local date crosses midnight", () => {
    expect(localDateKey("2026-09-24T23:00:00.000Z", "Asia/Manila")).toBe(
      "2026-09-25",
    );
  });
});
