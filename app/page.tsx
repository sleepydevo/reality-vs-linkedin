"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "./components/ThemeProvider";

// Dynamic import of PhotoEditor — Konva requires window
const PhotoEditor = dynamic(() => import("./components/PhotoEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 text-zinc-500">
      Loading editor...
    </div>
  ),
});

// ── Constants ────────────────────────────────────────────

const CANVAS_W = 1080;
const LINKEDIN_BLUE = "#0A66C2";
const WEB_URL = "https://reality-vs-linkedin.vercel.app"; // Your deployed URL
const DIVIDER_X = CANVAS_W / 2;
const SIDE_PADDING = 60;
const TEXT_MAX_W = DIVIDER_X - SIDE_PADDING * 2;
const LINE_HEIGHT = 36;
const HEADER_ZONE = 160; // top padding + header + rule
const MIN_CANVAS_H = 420;
const FOOTER_ZONE = 70;
const BODY_PAD_TOP = 50;
const BODY_PAD_BOTTOM = 50;
const PHOTO_MAX_W = TEXT_MAX_W;
const PHOTO_MAX_H = 400;
const PHOTO_TEXT_GAP = 50;

// ── Canvas helpers ───────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Fit an image into a bounding box, preserving aspect ratio.
 * Returns { drawW, drawH }.
 */
function fitImage(
  imgW: number,
  imgH: number,
  maxW: number,
  maxH: number
): { drawW: number; drawH: number } {
  const scale = Math.min(maxW / imgW, maxH / imgH);
  return { drawW: imgW * scale, drawH: imgH * scale };
}

function getLuminance(hex: string) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  } else if (hex.length !== 6) {
    return 1; // default to light
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ── Main draw function (async for image loading) ─────────

async function drawCard(
  canvas: HTMLCanvasElement,
  realityText: string,
  linkedInText: string,
  realityPhotoUrl?: string | null,
  linkedInPhotoUrl?: string | null,
  bgColor: string = "#FFFFFF"
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // ── Load photos if provided ──
  let realityImg: HTMLImageElement | null = null;
  let linkedInImg: HTMLImageElement | null = null;
  if (realityPhotoUrl) {
    try {
      realityImg = await loadImage(realityPhotoUrl);
    } catch {
      /* skip photo on error */
    }
  }
  if (linkedInPhotoUrl) {
    try {
      linkedInImg = await loadImage(linkedInPhotoUrl);
    } catch {
      /* skip photo on error */
    }
  }

  // ── Measure text ──
  // Need a temporary canvas size to measure text
  canvas.width = CANVAS_W;
  canvas.height = 100; // temporary
  ctx.font = "400 26px Inter, system-ui, sans-serif";
  const realityLines = wrapText(ctx, realityText, TEXT_MAX_W);
  const linkedInLines = wrapText(ctx, linkedInText, TEXT_MAX_W);
  const maxTextLines = Math.max(realityLines.length, linkedInLines.length);
  const textBlockH = maxTextLines * LINE_HEIGHT;

  // ── Compute photo section height ──
  let photoSectionH = 0;
  let realityFit = { drawW: 0, drawH: 0 };
  let linkedInFit = { drawW: 0, drawH: 0 };

  if (realityImg || linkedInImg) {
    if (realityImg) {
      realityFit = fitImage(
        realityImg.width,
        realityImg.height,
        PHOTO_MAX_W,
        PHOTO_MAX_H
      );
    }
    if (linkedInImg) {
      linkedInFit = fitImage(
        linkedInImg.width,
        linkedInImg.height,
        PHOTO_MAX_W,
        PHOTO_MAX_H
      );
    }
    photoSectionH =
      Math.max(realityFit.drawH, linkedInFit.drawH) + PHOTO_TEXT_GAP;
  }

  // ── Compute dynamic height ──
  const dynamicH =
    HEADER_ZONE +
    BODY_PAD_TOP +
    photoSectionH +
    textBlockH +
    BODY_PAD_BOTTOM +
    FOOTER_ZONE;
  const canvasH = Math.max(MIN_CANVAS_H, dynamicH);

  // ── Set final canvas dimensions ──
  canvas.width = CANVAS_W;
  canvas.height = canvasH;

  const isDark = getLuminance(bgColor) < 0.5;
  const textColor = isDark ? "#FFFFFF" : "#18181B";
  const dividerColor = isDark ? "#3F3F46" : "#E4E4E7";
  const footerColor = isDark ? "#71717A" : "#A1A1AA";

  // ── Background ──
  ctx.fillStyle = bgColor;
  roundRect(ctx, 0, 0, CANVAS_W, canvasH, 32);
  ctx.fill();

  // ── Divider ──
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(DIVIDER_X, 60);
  ctx.lineTo(DIVIDER_X, canvasH - 60);
  ctx.stroke();

  // ── Headers ──
  ctx.fillStyle = textColor;
  ctx.font = "bold 42px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Reality", DIVIDER_X / 2, 130);

  // "LinkedIn" with blue "in" badge
  const headerCX = DIVIDER_X + DIVIDER_X / 2;
  const linkedWord = "Linked";
  const inWord = "in";
  ctx.font = "bold 42px Inter, system-ui, sans-serif";
  const linkedW = ctx.measureText(linkedWord).width;
  const inW = ctx.measureText(inWord).width;
  const hStartX = headerCX - (linkedW + inW) / 2;

  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.fillText(linkedWord, hStartX, 130);

  const inX = hStartX + linkedW;
  const inPad = 6;
  const inBoxH = 46;
  ctx.fillStyle = LINKEDIN_BLUE;
  roundRect(ctx, inX - inPad, 130 - inBoxH + 9, inW + inPad * 2, inBoxH, 6);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(inWord, inX, 130);

  // ── Rule under headers ──
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIDE_PADDING, HEADER_ZONE);
  ctx.lineTo(CANVAS_W - SIDE_PADDING, HEADER_ZONE);
  ctx.stroke();

  // ── Content zone (vertically centered) ──
  const contentTotalH = photoSectionH + textBlockH;
  const availableH = canvasH - HEADER_ZONE - FOOTER_ZONE - BODY_PAD_TOP - BODY_PAD_BOTTOM;
  const contentOffsetY =
    HEADER_ZONE + BODY_PAD_TOP + Math.max(0, (availableH - contentTotalH) / 2);

  // ── Draw photos ──
  let textStartY = contentOffsetY;

  if (realityImg || linkedInImg) {
    const photoY = contentOffsetY;

    if (realityImg) {
      const px = SIDE_PADDING + (TEXT_MAX_W - realityFit.drawW) / 2;
      // Clip to rounded rect
      ctx.save();
      roundRect(ctx, px, photoY, realityFit.drawW, realityFit.drawH, 12);
      ctx.clip();
      ctx.drawImage(realityImg, px, photoY, realityFit.drawW, realityFit.drawH);
      ctx.restore();
      // Border
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 2;
      roundRect(ctx, px, photoY, realityFit.drawW, realityFit.drawH, 12);
      ctx.stroke();
    }

    if (linkedInImg) {
      const px =
        DIVIDER_X + SIDE_PADDING + (TEXT_MAX_W - linkedInFit.drawW) / 2;
      ctx.save();
      roundRect(ctx, px, photoY, linkedInFit.drawW, linkedInFit.drawH, 12);
      ctx.clip();
      ctx.drawImage(
        linkedInImg,
        px,
        photoY,
        linkedInFit.drawW,
        linkedInFit.drawH
      );
      ctx.restore();
      ctx.strokeStyle = dividerColor;
      ctx.lineWidth = 2;
      roundRect(ctx, px, photoY, linkedInFit.drawW, linkedInFit.drawH, 12);
      ctx.stroke();
    }

    textStartY = contentOffsetY + photoSectionH;
  }

  // ── Draw text ──
  ctx.fillStyle = isDark ? "#E4E4E7" : "#3F3F46";
  ctx.font = "400 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  realityLines.forEach((line, i) => {
    ctx.fillText(line, SIDE_PADDING, textStartY + i * LINE_HEIGHT);
  });

  linkedInLines.forEach((line, i) => {
    ctx.fillText(
      line,
      DIVIDER_X + SIDE_PADDING,
      textStartY + i * LINE_HEIGHT
    );
  });

  // ── Footer ──
  ctx.fillStyle = footerColor;
  ctx.font = "400 18px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("realityvslinkedin.vercel.app", CANVAS_W / 2, canvasH - 30);
}

import { SURPRISE_ME_PROMPTS } from "./presets";

// ── Example prompts ──────────────────────────────────────

const EXAMPLES = [
  "I ate a banana",
  "I took a nap at 2pm",
  "I refilled the coffee machine",
  "I watched three episodes of a show",
  "I replied to an email",
  "I stared out the window for 10 minutes",
  "I microwaved leftover pasta",
  "I forgot someone's name in a meeting",
];

// ── Main page ────────────────────────────────────────────

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{
    reality: string;
    linkedin: string;
  } | null>(null);

  const handleSurpriseMe = () => {
    const randomPrompt = SURPRISE_ME_PROMPTS[Math.floor(Math.random() * SURPRISE_ME_PROMPTS.length)];
    setInput(randomPrompt);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [cardColor, setCardColor] = useState<string>("#FFFFFF");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Photo mode state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [editedPhotoDataUrl, setEditedPhotoDataUrl] = useState<string | null>(
    null
  );
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [shareToast, setShareToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate placeholder
  useEffect(() => {
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % EXAMPLES.length;
      setPlaceholder(EXAMPLES[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Redraw canvas when result changes
  useEffect(() => {
    if (result && canvasRef.current) {
      drawCard(
        canvasRef.current,
        result.reality,
        result.linkedin,
        photoDataUrl,
        editedPhotoDataUrl || photoDataUrl,
        cardColor
      );
    }
  }, [result, photoDataUrl, editedPhotoDataUrl, cardColor]);

  // ── Global Paste Handler ──
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              setPhotoDataUrl(reader.result as string);
              setEditedPhotoDataUrl(null);
              setShowUploadModal(false);
              setShowPhotoEditor(true);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // ── Photo handlers ──
  const handlePhotoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPhotoDataUrl(dataUrl);
        setEditedPhotoDataUrl(null);
        setShowUploadModal(false);
        setShowPhotoEditor(true);
      };
      reader.readAsDataURL(file);
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    []
  );

  const handlePhotoEditorExport = useCallback((flattenedDataUrl: string) => {
    setEditedPhotoDataUrl(flattenedDataUrl);
    setShowPhotoEditor(false);
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setEditedPhotoDataUrl(null);
    setShowPhotoEditor(false);
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, length }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }

      setResult({ reality: trimmed, linkedin: data.result });
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [input, length]);

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "reality-vs-linkedin.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png")
      );
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy image: ", err);
      // Fallback or error handling could go here
    }
  }, []);

  const handleShare = useCallback(async () => {
    if (!canvasRef.current) return;
    
    const shareText = `Just corporate-ified my day on Reality vs LinkedIn! 🚀 Try it yourself: ${WEB_URL}`;
    
    try {
      // Step 1: Generate the image blob from canvas
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png")
      );
      if (!blob) return;

      const file = new File([blob], "reality-vs-linkedin.png", { type: "image/png" });

      // Step 2: Native share (mobile) — shares the actual image file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Reality vs LinkedIn",
          text: shareText,
          files: [file],
        });
        return;
      }

      // Step 3: Fallback (Desktop/unsupported browsers) - Copy image to clipboard so user can paste it
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
      } catch {
        // Clipboard write may fail in some browsers, continue anyway
      }

      // Step 4: Fallback auto-download the image
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "reality-vs-linkedin.png";
      a.click();
      URL.revokeObjectURL(downloadUrl);

      // Step 5: Show toast telling user to paste the image
      setShareToast("✅ Image copied & downloaded! Paste it (Ctrl+V) in your post.");
      setTimeout(() => setShareToast(null), 5000);
    } catch (err) {
      console.log("Error sharing:", err);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <main className="flex flex-col items-center px-4 py-10 sm:py-16 gap-8 max-w-2xl mx-auto">
      {/* ── Header ── */}
      <header className="text-center space-y-3 relative w-full">
        {/* Theme Toggle */}
        <button
          onClick={() => {
            if (theme === 'system') setTheme('light');
            else if (theme === 'light') setTheme('dark');
            else setTheme('system');
          }}
          className="fixed top-4 right-4 z-50 p-2.5 rounded-full border shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-10 h-10"
          style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}
          title={`Theme: ${theme}`}
        >
          {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
        </button>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Reality{" "}
          <span style={{ color: 'var(--text-muted)' }} className="font-normal text-3xl sm:text-4xl">
            vs
          </span>{" "}
          <span>
            Linked
            <span
              className="inline-block px-1.5 py-0.5 rounded-md text-white ml-px"
              style={{ backgroundColor: LINKEDIN_BLUE }}
            >
              in
            </span>
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }} className="text-base sm:text-lg max-w-md mx-auto">
          Type something mundane you did today.
          <br />
          We&apos;ll turn it into peak thought leadership.
        </p>
      </header>

      {/* ── Input area ── */}
      <div className="w-full space-y-3">
        <div className="relative w-full">
          <textarea
            id="reality-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            maxLength={500}
            rows={4}
            className="w-full rounded-xl border px-4 py-3 pb-12 placeholder-zinc-500 
                       focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/60 focus:border-transparent
                       resize-none transition-all duration-200 text-base sm:text-lg"
            style={{ backgroundColor: 'var(--input-bg)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            disabled={loading}
            aria-label="What did you actually do today?"
          />
          
          <button
            onClick={handleSurpriseMe}
            className="absolute bottom-3 right-3 text-sm font-bold px-4 py-1.5 rounded-full border-2 transition-all hover:bg-[#0a66c2]/10 shadow-sm bg-transparent"
            style={{ borderColor: '#0a66c2', color: '#0a66c2' }}
            title="Give me a random scenario"
          >
            Surprise Me 🎲
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <span className="text-xs hidden sm:inline-block shrink-0" style={{ color: 'var(--text-muted)' }}>{input.length}/500</span>

            <select
              value={length}
              onChange={(e) => setLength(e.target.value as "short" | "medium" | "long")}
              className="border text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#0A66C2]/60 focus:outline-none shrink-0"
              style={{ backgroundColor: 'var(--select-bg)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <option value="short">Short (1 sentence)</option>
              <option value="medium">Medium (2-3 sentences)</option>
              <option value="long">Long (Full Broetry)</option>
            </select>

            {!photoDataUrl && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-500/50 hover:border-emerald-500/50 rounded-lg text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] shrink-0 group"
                title="Add a photo"
              >
                <span className="group-hover:scale-110 transition-transform">📸</span> Add Photo
              </button>
            )}
          </div>

          <button
            id="corporateify-button"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className="relative px-6 py-2.5 rounded-xl font-semibold text-white text-sm sm:text-base
                       bg-gradient-to-r from-[#0A66C2] to-[#004182]
                       hover:from-[#0b7aee] hover:to-[#0A66C2]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all duration-200 active:scale-95
                       shadow-lg shadow-blue-900/30"
          >
            {loading ? (
              <span className="flex items-center gap-1.5 justify-center">
                <span className="loading-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
                <span className="loading-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
                <span className="loading-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
              </span>
            ) : (
              "Corporate-ify it 🚀"
            )}
          </button>
        </div>
      </div>

      {/* ── Upload Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative" style={{ backgroundColor: 'var(--modal-bg)', borderColor: 'var(--border-primary)' }}>
            <button 
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white z-10 p-2 text-xl"
              title="Close"
            >
              ✕
            </button>
            
            {/* Left Side: File Upload */}
            <div className="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r border-zinc-700 flex flex-col items-center justify-center text-center gap-4 hover:bg-zinc-800/50 transition-colors">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 text-3xl">
                📁
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Select from Storage</h3>
                <p className="text-sm text-zinc-400 mb-6">Browse your computer for an image.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-[#0A66C2] hover:bg-[#0b7aee] text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/30"
                >
                  Choose File
                </button>
              </div>
            </div>

            {/* Right Side: Paste */}
            <div className="flex-1 p-8 md:p-12 flex flex-col items-center justify-center text-center gap-4 bg-zinc-900/80 relative">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-3xl">
                📋
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Paste Image</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Just press <br/>
                  <strong className="text-zinc-200 text-base bg-zinc-800 px-3 py-1.5 rounded-md mt-3 inline-block border border-zinc-700 shadow-inner tracking-widest">
                    Ctrl + V
                  </strong> <br/>
                  <span className="text-xs mt-2 inline-block opacity-70">(or Cmd + V on Mac)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo preview / editor ── */}
      {photoDataUrl && !showPhotoEditor && (
        <div className="w-full flex items-center gap-3 px-1">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700/60 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={editedPhotoDataUrl || photoDataUrl}
              alt="Uploaded preview"
              className="w-full h-full object-cover"
            />
            {editedPhotoDataUrl && (
              <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/80 text-[8px] text-center text-white py-px">
                edited
              </div>
            )}
          </div>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setShowPhotoEditor(true)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ✏️ Edit props
            </button>
            <button
              onClick={handleRemovePhoto}
              className="text-zinc-500 hover:text-red-400 transition-colors"
            >
              ✕ Remove
            </button>
          </div>
        </div>
      )}

      {showPhotoEditor && photoDataUrl && (
        <div className="w-full">
          <PhotoEditor
            photoDataUrl={photoDataUrl}
            onExport={handlePhotoEditorExport}
            onCancel={() => setShowPhotoEditor(false)}
          />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          role="alert"
          className="w-full px-4 py-3 rounded-xl bg-red-900/30 border border-red-800/50 text-red-300 text-sm"
        >
          {error}
        </div>
      )}

      {/* ── Result canvas ── */}
      {result && (
        <div className="w-full space-y-6 animate-in fade-in duration-500">
          {/* Card Color Picker */}
          <div className="flex flex-col items-center gap-3">
            <span className="text-sm font-medium uppercase tracking-widest text-xs" style={{ color: 'var(--text-secondary)' }}>Card Color</span>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-zinc-700 shadow-sm hover:scale-105 transition-transform focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="color"
                  value={cardColor}
                  onChange={(e) => setCardColor(e.target.value)}
                  className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer"
                  title="Choose card color"
                />
              </div>
              <span className="text-sm font-mono uppercase px-2 py-1 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)' }}>
                {cardColor}
              </span>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border shadow-2xl" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)', boxShadow: `0 25px 50px -12px var(--shadow-color)` }}>
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxWidth: "100%" }}
            />
          </div>

          <div className="flex gap-3 justify-center">
            <button
              id="download-button"
              onClick={handleDownload}
              className="px-5 py-2.5 rounded-xl font-medium text-sm
                         border
                         hover:opacity-80
                         transition-all duration-200 active:scale-95"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              📥 Download PNG
            </button>

            <button
              id="copy-button"
              onClick={handleCopy}
              className="px-5 py-2.5 rounded-xl font-medium text-sm
                         border
                         hover:opacity-80
                         transition-all duration-200 active:scale-95"
              style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
            
            <div className="relative">
              <button
                onClick={handleShare}
                className="px-5 py-2.5 rounded-xl font-medium text-sm text-white
                           bg-gradient-to-r from-blue-600 to-indigo-600
                           hover:from-blue-500 hover:to-indigo-500
                           transition-all duration-200 active:scale-95
                           shadow-lg shadow-blue-900/30 flex items-center gap-2"
              >
                🚀 Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="mt-12 mb-8 text-center text-xs flex flex-col gap-5 items-center" style={{ color: 'var(--text-muted)' }}>
        <div>Powered by AI &amp; regret. No data stored, no accounts, just vibes.</div>
        
        <div className="flex flex-col items-center gap-3 mt-2">
          <div className="text-sm font-medium">Made by sleepydev</div>
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=testacountsai7@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 bg-[#0a66c2] rounded-full hover:bg-[#004182] hover:scale-105 focus:outline-none shadow-sm"
          >
            <span className="flex items-center gap-2">
              ✉️ Contact
            </span>
          </a>
        </div>
      </footer>

      {/* ── Share Toast ── */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3.5 border text-sm font-medium rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 theme-toast">
          <span className="text-lg">📋</span>
          <span>{shareToast}</span>
          <button onClick={() => setShareToast(null)} className="ml-2 text-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}>&times;</button>
        </div>
      )}
    </main>
  );
}
