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
  const [cringeLevel, setCringeLevel] = useState<number>(1);
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
        body: JSON.stringify({ text: trimmed, length, cringeLevel }),
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
  }, [input, length, cringeLevel]);

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

  const handleShareSite = useCallback(async () => {
    const shareText = `Check out Reality vs LinkedIn! It's a hilarious corporate BS translator that turns your mundane tasks into peak thought leadership. 🚀`;
    const shareUrl = WEB_URL;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Reality vs LinkedIn",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        console.log("Error sharing site:", err);
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setShareToast("✅ Link copied to clipboard!");
      setTimeout(() => setShareToast(null), 3000);
    } catch (err) {
      console.log("Error copying link:", err);
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
        {/* Floating actions */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
          <button
            onClick={handleShareSite}
            className="p-2.5 rounded-full border shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-10 h-10"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}
            title="Share this site"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (theme === 'system') setTheme('light');
              else if (theme === 'light') setTheme('dark');
              else setTheme('system');
            }}
            className="p-2.5 rounded-full border shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center w-10 h-10"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}
            title={`Theme: ${theme}`}
          >
            {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻'}
          </button>
        </div>

        <div className="flex justify-center mb-6 mt-2">
          <a
            href="https://www.producthunt.com/products/reality-vs-linkedin-cringe?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-reality-vs-linkedin-cringe"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:scale-105 transition-transform"
          >
            <img
              alt="Reality vs Linkedin cringe - The corporate BS translator you didn't know you needed | Product Hunt"
              width="250"
              height="54"
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1198275&theme=light&t=1784298736477"
            />
          </a>
        </div>

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
            className="absolute bottom-3 right-3 text-sm font-medium px-4 py-1.5 rounded-full border border-zinc-700/50 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-2"
            title="Give me a random scenario"
          >
            Surprise Me 🎲
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full bg-[#111118]/80 border border-zinc-800/80 rounded-2xl p-2.5 mt-2">
          {/* Left side: char count and select */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-medium text-zinc-500 pl-3 shrink-0">{input.length}/500</span>

            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as "short" | "medium" | "long")}
                className="bg-zinc-900 border border-zinc-700/50 text-sm rounded-xl pl-9 pr-8 py-2.5 text-zinc-300 focus:ring-1 focus:ring-zinc-600 focus:outline-none hover:border-zinc-600 transition-colors appearance-none cursor-pointer"
              >
                <option value="short">Short (1 sentence)</option>
                <option value="medium">Medium (2-3 sentences)</option>
                <option value="long">Long (Full Broetry)</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          {/* Middle: Cringe Slider */}
          <div className="hidden sm:flex flex-col items-center justify-center px-4 w-48">
            <span className="text-[9px] font-bold text-zinc-500 tracking-widest mb-1.5 uppercase">
              {cringeLevel === 1 ? 'Mildly Annoying' : cringeLevel === 2 ? 'Unhinged CEO' : 'Final Boss Lunatic'}
            </span>
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={cringeLevel}
              onChange={(e) => setCringeLevel(Number(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#4A72FF]"
            />
          </div>

          {/* Right side: Photo and Submit */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!photoDataUrl && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-500 rounded-xl text-sm font-medium text-zinc-300 hover:text-white transition-colors shrink-0"
                title="Add a photo"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                Add Photo
              </button>
            )}

            <button
              id="corporateify-button"
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="relative px-6 py-2.5 rounded-xl font-semibold text-white text-sm sm:text-base
                         bg-[#4A72FF] hover:bg-[#3D63FF]
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 min-w-[160px]"
            >
              {loading ? (
                <span className="flex items-center gap-1.5 justify-center h-5">
                  <span className="loading-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
                  <span className="loading-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
                  <span className="loading-dot w-1.5 h-1.5 rounded-full bg-white inline-block" />
                </span>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
                  </svg>
                  Corporate-ify it
                </>
              )}
            </button>
          </div>
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
      <div className="w-full max-w-3xl flex items-center justify-center mt-16 mb-8">
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent flex-1"></div>
        <div className="px-4 text-[#4A72FF]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="h-px bg-gradient-to-r from-zinc-800 via-transparent to-transparent flex-1"></div>
      </div>

      <footer className="mb-8 text-center text-xs flex flex-col gap-4 items-center text-zinc-500">
        <div>Powered by AI & regret. No data stored, no accounts, just vibes.</div>
        
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm font-medium text-zinc-400">Made by sleepydev</div>
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=testacountsai7@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-zinc-400 bg-transparent border border-zinc-700/60 rounded-full hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
            Contact
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
