import { describe, it, expect } from "vitest";
import { statusStyle, ALL_STATUSES } from "@/lib/status-style";
import { BOARD_GROUPS, STATUS_ORDER } from "@/lib/kanban";

describe("statusStyle", () => {
  it("covers every status", () => {
    for (const s of ALL_STATUSES) {
      expect(statusStyle(s).dot, s).toBeTruthy();
    }
  });

  it("leaves APPLIED unpainted — 'sent and waiting' is the baseline, not a signal", () => {
    expect(statusStyle("APPLIED").row).toBe("");
  });

  it("distinguishes SAVED from APPLIED — not sent yet is not the same as no reply", () => {
    expect(statusStyle("SAVED").row).not.toBe(statusStyle("APPLIED").row);
  });

  it("keeps SAVED off the grey scale so it can't be mistaken for a dead row", () => {
    expect(statusStyle("SAVED").row).toContain("sky");
    for (const dead of ["REJECTED", "GHOSTED"]) {
      expect(statusStyle(dead).row, dead).toContain("neutral");
    }
  });

  it("makes an explicit rejection darker than a ghosting", () => {
    expect(statusStyle("REJECTED").row).toContain("neutral-200");
    expect(statusStyle("GHOSTED").row).toContain("neutral-100");
  });

  it("mutes the dead states so live rows read first", () => {
    for (const s of ["REJECTED", "GHOSTED"]) {
      expect(statusStyle(s).row, s).toContain("text-muted-foreground");
    }
  });

  it("greens deepen as the process advances", () => {
    // A glance down the column should show progress without reading the labels.
    const shades = ["OA", "INTERVIEW", "OFFER"].map((s) => statusStyle(s).row);
    expect(new Set(shades).size).toBe(3);
    for (const c of shades) expect(c).toContain("green");
  });

  it("gives every status its own dot colour", () => {
    const dots = ALL_STATUSES.map((s) => statusStyle(s).dot);
    expect(new Set(dots).size).toBe(dots.length);
  });

  it("falls back instead of throwing on an unknown status", () => {
    expect(statusStyle("NONSENSE").dot).toBeTruthy();
  });
});

describe("BOARD_GROUPS", () => {
  it("lays out every status exactly once", () => {
    const flat = BOARD_GROUPS.flatMap((g) => g.statuses);
    expect([...flat].sort()).toEqual([...STATUS_ORDER].sort());
  });

  it("keeps pipeline order within each row", () => {
    const flat = BOARD_GROUPS.flatMap((g) => g.statuses);
    expect(flat).toEqual(STATUS_ORDER);
  });

  it("splits into the three rows the board renders", () => {
    expect(BOARD_GROUPS.map((g) => g.statuses.length)).toEqual([2, 2, 3]);
  });
});
