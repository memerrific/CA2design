// Line icons (24 × 24 grid, stroke = currentColor).

const PATHS: Record<string, string> = {
  // sections
  heating: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  heatloss: 'M12 3v10M8 9a4 4 0 1 0 8 0M12 21a4 4 0 0 0 4-4H8a4 4 0 0 0 4 4z',
  survey: 'M4 4h16v16H4zM4 10h16M10 4v16',
  materials: 'M3 8h18M3 16h18M7 4v8M17 12v8',
  plantroom: 'M4 20V8l4-4h8l4 4v12M9 20v-6h6v6M8 9h8',
  pool: 'M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5S16 18 18 18s2-1.5 4-1.5M2 13c2 0 2-1.5 4-1.5S8 13 10 13s2-1.5 4-1.5S16 13 18 13M8 11V5a2 2 0 0 1 4 0',
  dhw: 'M7 3h10v18H7zM7 8h10M12 12v5M10 14l2-2 2 2',
  aircon: 'M3 6h18v6H3zM6 15c0 2 1 3 1 5M12 15v5M18 15c0 2-1 3-1 5',
  solar: 'M3 20l3-10h12l3 10zM9 10l-1 10M15 10l1 10M4 15h16M12 2v4',
  oil: 'M6 8h12v12H6zM9 8V5h6v3M9 14h6',
  service: 'M14 6l4 4-8 8H6v-4zM12 8l4 4',
  radiator: 'M4 6h16v12H4zM8 6v12M12 6v12M16 6v12M6 18v2M18 18v2',
  bath: 'M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1.5 3 2 3 2s0-3 0-5z',
  swap: 'M4 8h14l-3-3M20 16H6l3 3',
  extension: 'M3 20V10l6-5 6 5v10zM15 13h6v7h-6M3 20h18',
  ufh: 'M4 6h13a2 2 0 0 1 0 4H7a2 2 0 0 0 0 4h10a2 2 0 0 1 0 4H4',
  ev: 'M6 3h8v18H6zM14 9h2l2 2v5a1 1 0 0 0 2 0v-6l-2-2M11 7l-2 4h3l-2 4',
  home: 'M3 11l9-7 9 7M5 10v10h14V10',
  check: 'M5 12l5 5 9-10',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  chevronRight: 'M9 6l6 6-6 6',
  // app
  board: 'M4 4h5v16H4zM10 4h5v10h-5zM16 4h4v13h-4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  plusCircle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
  coins: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.5 9a2.5 2.5 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2A2.5 2.5 0 0 1 9.5 15M12 6v1.5M12 16.5V18',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4M12 17h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  chevronLeft: 'M15 6l-6 6 6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  sidebar: 'M4 4h16v16H4zM9 4v16M15 10l-2 2 2 2',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`ico ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.heating} />
    </svg>
  );
}
