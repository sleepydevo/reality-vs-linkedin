// ── Flat-vector SVG prop assets (intentionally clip-art meme style) ──

export interface PropAsset {
  id: string;
  label: string;
  emoji: string;
  svgDataUrl: string;
  defaultWidth: number;
  defaultHeight: number;
}

const tie = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 200">
  <polygon points="40,0 56,8 52,32 60,180 40,200 20,180 28,32 24,8" fill="#0A66C2"/>
  <polygon points="40,0 56,8 40,16 24,8" fill="#0952a5"/>
  <line x1="40" y1="32" x2="40" y2="180" stroke="#084a8e" stroke-width="1.5" opacity="0.4"/>
</svg>`;

const glasses = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80">
  <rect x="12" y="12" width="75" height="52" rx="12" fill="rgba(255,255,255,0.1)" stroke="#18181B" stroke-width="7"/>
  <rect x="133" y="12" width="75" height="52" rx="12" fill="rgba(255,255,255,0.1)" stroke="#18181B" stroke-width="7"/>
  <path d="M87,38 Q110,50 133,38" fill="none" stroke="#18181B" stroke-width="6"/>
  <line x1="12" y1="30" x2="0" y2="26" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
  <line x1="208" y1="30" x2="220" y2="26" stroke="#18181B" stroke-width="5" stroke-linecap="round"/>
</svg>`;

const blazer = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 200">
  <path d="M130,0 L85,25 L35,195 L0,195 L0,170 L65,15 L130,0 Z" fill="#1e293b"/>
  <path d="M130,0 L175,25 L225,195 L260,195 L260,170 L195,15 L130,0 Z" fill="#1e293b"/>
  <path d="M130,0 L85,25 L95,50 L130,30 L165,50 L175,25 Z" fill="#334155"/>
  <path d="M130,0 L115,35 L130,55 L145,35 Z" fill="#f1f5f9"/>
  <circle cx="130" cy="90" r="4" fill="#94a3b8"/>
  <circle cx="130" cy="115" r="4" fill="#94a3b8"/>
  <circle cx="130" cy="140" r="4" fill="#94a3b8"/>
</svg>`;

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(svg) : Buffer.from(svg).toString("base64")}`;
}

export const PROP_ASSETS: PropAsset[] = [
  {
    id: "tie",
    label: "Tie",
    emoji: "👔",
    svgDataUrl: svgToDataUrl(tie),
    defaultWidth: 60,
    defaultHeight: 150,
  },
  {
    id: "glasses",
    label: "Glasses",
    emoji: "🕶️",
    svgDataUrl: svgToDataUrl(glasses),
    defaultWidth: 150,
    defaultHeight: 55,
  },
  {
    id: "blazer",
    label: "Blazer",
    emoji: "🧥",
    svgDataUrl: svgToDataUrl(blazer),
    defaultWidth: 180,
    defaultHeight: 140,
  },
];
