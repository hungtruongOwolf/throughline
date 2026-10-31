import type { ReactNode } from "react";

const SIZES = {
  phone: "w-[390px] h-[844px] rounded-[44px]",
  board: "w-[1280px] h-[800px] rounded-[12px]",
  map: "w-[1536px] h-[960px] rounded-[12px]",
} as const;

/** A device outline for the Journey Control page; one of the few places a border means something. */
export function DeviceFrame({
  kind,
  label,
  scale = 1,
  children,
}: {
  kind: keyof typeof SIZES;
  label: string;
  scale?: number;
  children: ReactNode;
}) {
  return (
    <figure aria-label={label} className="shrink-0" style={{ zoom: scale }}>
      <div className={`overflow-hidden border-2 border-ink ${SIZES[kind]}`}>{children}</div>
    </figure>
  );
}
