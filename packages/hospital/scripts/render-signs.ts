import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { campus, renderSignSvg, renderTicketSvg } from "../src/index";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/signs");
mkdirSync(outDir, { recursive: true });

const labels = new Map(campus.nodes.map((n) => [n.id, n.label]));
for (const sign of campus.signs) {
  writeFileSync(join(outDir, `${sign.sign_id}.svg`), renderSignSvg(sign, labels) + "\n");
}

const ticket = renderTicketSvg({
  number: 1047,
  language: "es",
  qr_payload: "https://throughline.example/p/maria-001",
  stops: [
    { name: "Registration", zone: "blue", floor: 1, time: "9:15" },
    { name: "CT 1", zone: "gold", floor: 2, time: "9:50" },
    { name: "Vitals", zone: "rose", floor: 2, time: "10:40" },
  ],
});
writeFileSync(join(outDir, "ticket-template.svg"), ticket + "\n");

console.log(`wrote ${campus.signs.length} signs and the ticket template to docs/signs/`);
