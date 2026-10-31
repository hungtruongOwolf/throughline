import { describe, expect, it } from "vitest";
import { campus, renderSignSvg, renderTicketSvg } from "./index";

describe("renderers", () => {
  const labels = new Map(campus.nodes.map((n) => [n.id, n.label]));

  it("renders every sign as SVG containing its lines", () => {
    for (const sign of campus.signs) {
      const svg = renderSignSvg(sign, labels);
      expect(svg.startsWith("<svg")).toBe(true);
      for (const line of sign.lines) {
        for (const part of line.split("→"))
          expect(svg).toContain(part.trim().replace(/&/g, "&amp;"));
      }
    }
  });

  it("renders a ticket with the number, a QR code, and the synthetic mark", () => {
    const svg = renderTicketSvg({
      number: 1047,
      language: "en",
      qr_payload: "https://throughline.example/p/maria-001",
      stops: [{ name: "CT 2", zone: "gold", floor: 2 }],
    });
    expect(svg).toContain("Ticket 1047");
    expect(svg).toContain("Synthetic demo data");
    expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(100);
  });
});
