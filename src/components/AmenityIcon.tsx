/**
 * Bộ icon tiện ích phòng — theo claude.ai/design `Icon Tien ich.dc.html` (project 4ec052fe-…):
 * nét mảnh, góc bo tròn, một màu (currentColor), không dùng emoji. Khung 24×24.
 * airCon / pool / easyRoad không có trong bản thiết kế — vẽ cùng phong cách.
 */
export const AMENITY_PATHS = {
  heating: "M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 15h18M3 18v2M21 18v2M7 10V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3M9 3.5c.6.6.6 1.4 0 2M12 3.5c.6.6.6 1.4 0 2",
  cloudView: "M2 17l5-6 3.5 4 3-3.5L20 17M6.5 20.5h9a3 3 0 0 0 0-6 4 4 0 0 0-7.6 1.2A2.4 2.4 0 0 0 6.5 20.5z",
  breakfast: "M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M3 21h14M8 3c-.7 1 .7 2 0 3M12 3c-.7 1 .7 2 0 3",
  bathtub: "M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V5.5A2.5 2.5 0 0 1 8.5 3c1 0 1.8.6 2.2 1.4M10 6h2M7 19l-1 2M17 19l1 2",
  airCon: "M3 5h18v7H3zM6 9h12M8 16c-.7 1 .7 2 0 3M12 15v5M16 16c.7 1-.7 2 0 3",
  pool: "M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M8 15V5a2 2 0 0 1 4 0M16 15V5a2 2 0 0 1 4 0M8 8h8M8 12h8",
  easyRoad: "M8 3L4 21M16 3l4 18M12 4v2M12 10v3M12 17v3",
  heater: "M5 6h14v12H5zM9 6v12M12 6v12M15 6v12M7 21v-3M17 21v-3",
  balcony: "M4 21V11M20 21V11M3 11h18M8 11v10M12 11v10M16 11v10M3 21h18M7 11V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6",
  wifi: "M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  water: "M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11zM9.5 15a2.5 2.5 0 0 0 2.5 2.5",
  bbq: "M4 10h16a8 8 0 0 1-16 0zM7 17l-2 4M17 17l2 4M12 18v3M8 3c-.7 1 .7 2 0 3M12 3c-.7 1 .7 2 0 3M16 3c-.7 1 .7 2 0 3",
  parking: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 17V7h4a3 3 0 0 1 0 6H9",
  family: "M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3 21v-5a5 5 0 0 1 10 0v5M13.5 21v-3.5a3.5 3.5 0 0 1 7 0V21",
  glass: "M3 21V9l9-6 9 6v12zM3 21h18M12 3v18M3 9h18M7 13l2-2M15 15l3-3",
} as const;

export type AmenityIconName = keyof typeof AMENITY_PATHS;

export function AmenityIcon({ name, size = 14, stroke = 1.8, className }: { name: AmenityIconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" style={{ flex: "none" }}>
      <path d={AMENITY_PATHS[name]} />
    </svg>
  );
}
