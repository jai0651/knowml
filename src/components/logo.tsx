/* The KnowML mark: a K drawn as a tiny network, five nodes and three edges,
   the same drawing as app/icon.svg so the tab, the home-screen icon and the
   nav all match. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="kml-logo" x1="1" y1="1" x2="63" y2="63" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="15" fill="url(#kml-logo)" />
      <g stroke="#fff" strokeWidth="4.2" strokeLinecap="round">
        <line x1="19" y1="13" x2="19" y2="51" />
        <line x1="19" y1="32" x2="46" y2="13" />
        <line x1="19" y1="32" x2="46" y2="51" />
      </g>
      <g fill="#fff">
        <circle cx="19" cy="13" r="3.6" />
        <circle cx="19" cy="51" r="3.6" />
        <circle cx="19" cy="32" r="3.6" />
        <circle cx="46" cy="13" r="3.6" />
        <circle cx="46" cy="51" r="3.6" />
      </g>
    </svg>
  );
}
