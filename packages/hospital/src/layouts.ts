import {
  buildSite,
  siteFromCampus,
  type LayoutDepartment,
  type Site,
  type SiteLayout,
} from "./site";
import type { Campus } from "./schema";

/**
 * The sites of the hospitals on this deployment, by hospital id. Fictional campuses: sizes,
 * service times, and how busy each station gets are assumptions, not measurements.
 */

const st = (
  floor: number,
  label: string,
  zone: string,
  id: string,
  servers: number,
  service_min: number,
  peak: number,
): LayoutDepartment => ({ floor, label, zone, station: { id, servers, service_min, peak } });
const room = (floor: number, label: string, zone = "blue"): LayoutDepartment => ({
  floor,
  label,
  zone,
});
const amenity = (floor: number, label: string): LayoutDepartment => ({
  floor,
  label,
  zone: "gold",
  amenity: true,
});

export const NORTHGATE: SiteLayout = {
  name: "Northgate University Hospital",
  buildings: [
    {
      id: "NT",
      name: "North Tower",
      x: 0,
      y: 0,
      w: 66,
      d: 26,
      floors: 14,
      entrance: "North Tower Entrance",
      units: "Patient rooms",
      departments: [
        st(1, "Registration", "blue", "registration", 8, 3, 12),
        st(1, "Emergency", "rose", "emergency", 6, 14, 14),
        amenity(1, "Café"),
        st(2, "Lab draw", "green", "lab_draw", 6, 6, 11),
        st(2, "CT scan", "violet", "imaging_ct", 3, 15, 4),
        st(2, "MRI", "violet", "imaging_mri", 3, 40, 2),
        st(3, "Surgery check-in", "rose", "surgery", 3, 8, 7),
        room(3, "Operating rooms", "rose"),
        room(4, "Intensive care", "rose"),
        room(4, "Recovery", "rose"),
        st(9, "Neurology clinic", "violet", "neurology", 5, 20, 6),
        room(12, "Transplant unit", "green"),
        amenity(14, "Helipad"),
      ],
    },
    {
      id: "ST",
      name: "South Tower",
      x: 4,
      y: 46,
      w: 56,
      d: 24,
      floors: 12,
      units: "Patient rooms",
      departments: [
        st(1, "Pharmacy", "gold", "pharmacy", 3, 5, 8),
        amenity(1, "Chapel"),
        st(3, "Orthopedics clinic", "green", "orthopedics", 6, 18, 8),
        st(4, "Physical therapy", "green", "physical_therapy", 6, 30, 4),
        room(6, "Maternity", "rose"),
        room(7, "Pediatrics", "gold"),
      ],
    },
    {
      id: "HV",
      name: "Heart and Vascular Institute",
      x: 86,
      y: 2,
      w: 44,
      d: 30,
      floors: 8,
      entrance: "Heart Institute Entrance",
      units: "Cardiac rooms",
      departments: [
        st(1, "Heart check-in", "rose", "heart_checkin", 3, 4, 8),
        st(2, "Cardiology clinic", "rose", "cardiology", 8, 22, 10),
        st(3, "Echo lab", "rose", "echo", 4, 35, 3),
        st(4, "Cath lab", "rose", "cath_lab", 3, 60, 2),
        st(5, "Cardiac rehab", "green", "cardiac_rehab", 6, 45, 3),
      ],
    },
    {
      id: "OP",
      name: "Outpatient Pavilion",
      x: 86,
      y: 50,
      w: 52,
      d: 24,
      floors: 5,
      entrance: "Pavilion Entrance",
      departments: [
        st(1, "Outpatient lab", "green", "op_lab", 4, 6, 9),
        amenity(1, "Gift shop"),
        st(2, "Infusion center", "violet", "infusion", 10, 25, 9),
        st(3, "Medical oncology clinic", "violet", "oncology", 6, 20, 7),
        st(4, "Endoscopy", "gold", "endoscopy", 4, 35, 3),
        st(5, "Dialysis", "blue", "dialysis", 10, 50, 4),
      ],
    },
    {
      id: "PG",
      name: "Parking Garage",
      x: 156,
      y: 8,
      w: 34,
      d: 42,
      floors: 6,
      parking: true,
      departments: [],
    },
  ],
  bridges: [
    { a: "NT", b: "HV", floors: [1, 2, 4] },
    { a: "NT", b: "ST", floors: [1, 3] },
    { a: "HV", b: "OP", floors: [1, 2] },
    { a: "HV", b: "PG", floors: [1, 3] },
    { a: "OP", b: "ST", floors: [1] },
  ],
  day: ["registration", "lab_draw", "imaging_ct", "cardiology", "echo", "pharmacy"],
};

export const ST_BRENNAN: SiteLayout = {
  name: "St. Brennan Regional Medical Center",
  buildings: [
    {
      id: "MT",
      name: "Main Tower",
      x: 0,
      y: 0,
      w: 60,
      d: 28,
      floors: 10,
      entrance: "Main Entrance",
      units: "Patient rooms",
      departments: [
        st(1, "Registration", "blue", "registration", 6, 3, 10),
        st(1, "Emergency", "rose", "emergency", 5, 15, 12),
        amenity(1, "Café"),
        st(2, "Lab draw", "green", "lab_draw", 5, 6, 9),
        st(2, "X-ray", "violet", "imaging_xray", 2, 10, 5),
        st(3, "Surgery check-in", "rose", "surgery", 3, 8, 6),
        room(4, "Intensive care", "rose"),
      ],
    },
    {
      id: "WC",
      name: "Women's and Children's",
      x: 78,
      y: 0,
      w: 44,
      d: 26,
      floors: 7,
      entrance: "Women's and Children's Entrance",
      units: "Family rooms",
      departments: [
        st(1, "Family check-in", "gold", "family_checkin", 3, 4, 7),
        st(2, "Pediatrics clinic", "gold", "pediatrics", 7, 20, 9),
        st(3, "Labor and delivery", "rose", "labor", 6, 30, 5),
        room(4, "Newborn intensive care", "rose"),
      ],
    },
    {
      id: "MO",
      name: "Medical Office Building",
      x: 30,
      y: 46,
      w: 48,
      d: 22,
      floors: 4,
      entrance: "Medical Office Entrance",
      departments: [
        st(1, "Pharmacy", "gold", "pharmacy", 3, 5, 7),
        st(2, "Gastroenterology clinic", "green", "gastroenterology", 5, 20, 6),
        st(3, "Orthopedics clinic", "green", "orthopedics", 6, 18, 8),
        st(4, "Physical therapy", "green", "physical_therapy", 6, 30, 4),
      ],
    },
    {
      id: "PG",
      name: "Parking Garage",
      x: -44,
      y: 2,
      w: 30,
      d: 38,
      floors: 5,
      parking: true,
      departments: [],
    },
  ],
  bridges: [
    { a: "MT", b: "WC", floors: [1, 2, 3] },
    { a: "MT", b: "MO", floors: [1, 2] },
    { a: "MT", b: "PG", floors: [1, 2] },
  ],
  day: ["registration", "lab_draw", "imaging_xray", "orthopedics", "physical_therapy", "pharmacy"],
};

const HALDEN_BUILDINGS = { MP: "Main Pavilion", CC: "Cancer Center", G: "Garage A" };
const HALDEN_DAY = ["mp1.entrance", "lab_draw", "vitals", "imaging_ct", "clinic_2a", "infusion"];

/** Every hospital's site, by hospital id. */
export function sites(campus: Campus): Record<string, Site> {
  return {
    halden: siteFromCampus(campus, HALDEN_BUILDINGS, HALDEN_DAY),
    northgate: buildSite(NORTHGATE),
    "st-brennan": buildSite(ST_BRENNAN),
  };
}
