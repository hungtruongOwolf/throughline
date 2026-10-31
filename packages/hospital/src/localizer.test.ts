import { describe, expect, it } from "vitest";
import { campus } from "./index";
import { localize, signSimilarity } from "./localizer";

describe("sign localizer", () => {
  it("never confuses signs that differ only by an identifier", () => {
    expect(signSimilarity("Clinic 2A Waiting", "Clinic 2B Waiting")).toBe(0);
    expect(signSimilarity("Elevator B Level 2", "Elevator B Level 3")).toBe(0);
  });

  it("tolerates OCR noise and accents", () => {
    expect(localize("ELEVATOR A", campus.signs).node_id).toBe("mp1.elevA");
    expect(localize("Elevator A - Level 2", campus.signs).node_id).toBe("mp2.elevA");
    expect(localize("Outpatient Lab Waitlng", campus.signs).node_id).toBe("mp1.lab_wait");
    expect(localize("Cafe", campus.signs).node_id).toBe("mp1.cafe");
    expect(localize("Garden Link -> Cancer Center", campus.signs).node_id).toBe("mp1.garden_door");
  });

  it("returns unknown instead of a wrong node", () => {
    expect(localize("Emergency Department", campus.signs).node_id).toBe("unknown");
    expect(localize("Clinic 4C Waiting", campus.signs).node_id).toBe("unknown");
  });
});
