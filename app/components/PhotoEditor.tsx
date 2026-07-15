"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { PROP_ASSETS, PropAsset } from "./props";

// ── Types ──────────────────────────────────────────────

interface PlacedProp {
  id: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

interface PhotoEditorProps {
  photoDataUrl: string;
  onExport: (flattenedDataUrl: string) => void;
  onCancel: () => void;
}

// ── Constants ──────────────────────────────────────────

const EDITOR_SIZE = 450;

// ── Helper: load image from URL ────────────────────────

function useLoadedImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  return image;
}

// ── Main Component ─────────────────────────────────────

export default function PhotoEditor({
  photoDataUrl,
  onExport,
  onCancel,
}: PhotoEditorProps) {
  const [placedProps, setPlacedProps] = useState<PlacedProp[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [propImages, setPropImages] = useState<
    Record<string, HTMLImageElement>
  >({});
  const [showCustomModal, setShowCustomModal] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const customPropFileRef = useRef<HTMLInputElement>(null);

  // Load user photo
  const backgroundImage = useLoadedImage(photoDataUrl);

  // Compute scale to fit photo into editor
  const bgScale = backgroundImage
    ? Math.min(
        EDITOR_SIZE / backgroundImage.width,
        EDITOR_SIZE / backgroundImage.height
      )
    : 1;
  const bgWidth = backgroundImage ? backgroundImage.width * bgScale : EDITOR_SIZE;
  const bgHeight = backgroundImage
    ? backgroundImage.height * bgScale
    : EDITOR_SIZE;

  // Preload all prop SVG images
  useEffect(() => {
    const loaded: Record<string, HTMLImageElement> = {};
    let count = 0;
    PROP_ASSETS.forEach((asset) => {
      const img = new window.Image();
      img.onload = () => {
        loaded[asset.id] = img;
        count++;
        if (count === PROP_ASSETS.length) {
          setPropImages({ ...loaded });
        }
      };
      img.src = asset.svgDataUrl;
    });
  }, []);

  // Attach transformer to selected node
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr || !layerRef.current) return;

    if (selectedId) {
      const node = layerRef.current.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
      } else {
        tr.nodes([]);
      }
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, placedProps]);

  // Add a prop to the stage
  const addProp = useCallback(
    (asset: PropAsset) => {
      const newProp: PlacedProp = {
        id: `${asset.id}-${Date.now()}`,
        assetId: asset.id,
        x: bgWidth / 2 - asset.defaultWidth / 2,
        y: bgHeight / 2 - asset.defaultHeight / 2,
        width: asset.defaultWidth,
        height: asset.defaultHeight,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      setPlacedProps((prev) => [...prev, newProp]);
      setSelectedId(newProp.id);
    },
    [bgWidth, bgHeight]
  );

  // Add custom prop from data URL
  const addCustomProp = useCallback((dataUrl: string) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const assetId = `custom-${Date.now()}`;
      setPropImages((prev) => ({ ...prev, [assetId]: img }));
      
      const defaultSize = 100;
      let width = img.width;
      let height = img.height;
      
      if (width > defaultSize || height > defaultSize) {
        const ratio = Math.min(defaultSize / width, defaultSize / height);
        width *= ratio;
        height *= ratio;
      }
      
      const newProp: PlacedProp = {
        id: `${assetId}-${Date.now()}`,
        assetId: assetId,
        x: bgWidth / 2 - width / 2,
        y: bgHeight / 2 - height / 2,
        width,
        height,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
      setPlacedProps((prev) => [...prev, newProp]);
      setSelectedId(newProp.id);
    };
    img.src = dataUrl;
  }, [bgWidth, bgHeight]);

  const handleCustomPropUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        addCustomProp(reader.result as string);
        setShowCustomModal(false);
      };
      reader.readAsDataURL(file);
    }
  }, [addCustomProp]);

  // Paste handler for editor
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const reader = new FileReader();
            reader.onload = () => {
              addCustomProp(reader.result as string);
              setShowCustomModal(false);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste, { capture: true });
    return () => window.removeEventListener("paste", handlePaste, { capture: true });
  }, [addCustomProp]);

  // Remove selected prop
  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setPlacedProps((prev) => prev.filter((p) => p.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Deselect on empty click
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage() || e.target.attrs.id === "bg-photo") {
        setSelectedId(null);
      }
    },
    []
  );

  // Export flattened image
  const handleExport = useCallback(() => {
    if (!stageRef.current) return;

    // Deselect to hide transformer handles
    setSelectedId(null);

    // Use setTimeout so state update propagates before export
    setTimeout(() => {
      if (!stageRef.current) return;
      const dataUrl = stageRef.current.toDataURL({
        pixelRatio: 1080 / bgWidth, // export at high res
      });
      onExport(dataUrl);
    }, 50);
  }, [bgWidth, onExport]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      setPlacedProps((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, x: e.target.x(), y: e.target.y() } : p
        )
      );
    },
    []
  );

  // Handle transform end
  const handleTransformEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      setPlacedProps((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY(),
              }
            : p
        )
      );
    },
    []
  );

  if (!backgroundImage) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Loading photo...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-white">Edit for LinkedIn style</h3>
        <p className="text-sm text-zinc-400">
          Drag props onto your photo. Tap or click to select, then resize &amp; rotate.
        </p>
      </div>

      {/* Konva Stage */}
      <div
        className="mx-auto rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-900"
        style={{ width: bgWidth, maxWidth: "100%" }}
      >
        <Stage
          ref={stageRef}
          width={bgWidth}
          height={bgHeight}
          onClick={handleStageClick}
          onTap={handleStageClick}
          style={{ maxWidth: "100%", cursor: "default" }}
        >
          <Layer ref={layerRef}>
            {/* Background photo */}
            <KonvaImage
              id="bg-photo"
              image={backgroundImage}
              width={bgWidth}
              height={bgHeight}
            />

            {/* Placed props */}
            {placedProps.map((prop) => {
              const img = propImages[prop.assetId];
              if (!img) return null;
              return (
                <KonvaImage
                  key={prop.id}
                  id={prop.id}
                  image={img}
                  x={prop.x}
                  y={prop.y}
                  width={prop.width}
                  height={prop.height}
                  rotation={prop.rotation}
                  scaleX={prop.scaleX}
                  scaleY={prop.scaleY}
                  draggable
                  onClick={() => setSelectedId(prop.id)}
                  onTap={() => setSelectedId(prop.id)}
                  onDragEnd={(e) => handleDragEnd(prop.id, e)}
                  onTransformEnd={(e) => handleTransformEnd(prop.id, e)}
                />
              );
            })}

            {/* Transformer */}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>

      {/* Prop tray */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 overflow-x-auto px-2">
        <span className="text-xs text-zinc-500 mr-2">Add props:</span>
        {PROP_ASSETS.map((asset) => (
          <button
            key={asset.id}
            onClick={() => addProp(asset)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-sm
                       hover:bg-zinc-700 hover:border-zinc-600 transition-all duration-200
                       active:scale-95"
            title={`Add ${asset.label}`}
          >
            {asset.emoji} {asset.label}
          </button>
        ))}

        <input
          ref={customPropFileRef}
          type="file"
          accept="image/*"
          onChange={handleCustomPropUpload}
          className="hidden"
        />
        <button
          onClick={() => setShowCustomModal(true)}
          className="px-3 py-2 rounded-lg bg-emerald-900/40 border border-emerald-800/50 text-sm text-emerald-400
                     hover:bg-emerald-900/60 transition-all duration-200 active:scale-95"
          title="Upload your own prop or paste"
        >
          ➕ Custom
        </button>

        {selectedId && (
          <button
            onClick={removeSelected}
            className="px-3 py-2 rounded-lg bg-red-900/40 border border-red-800/50 text-sm text-red-300
                       hover:bg-red-900/60 transition-all duration-200 active:scale-95"
            title="Remove selected prop"
          >
            🗑️ Remove
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700
                     hover:bg-zinc-700 hover:text-white transition-all duration-200 active:scale-95"
        >
          Skip (Use original)
        </button>
        <button
          onClick={handleExport}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white
                     bg-gradient-to-r from-emerald-600 to-emerald-700
                     hover:from-emerald-500 hover:to-emerald-600
                     transition-all duration-200 active:scale-95
                     shadow-lg shadow-emerald-900/30"
        >
          Save Edited Photo
        </button>
      </div>

      {/* ── Custom Prop Modal ── */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
            <button 
              onClick={() => setShowCustomModal(false)}
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
                <h3 className="text-xl font-bold text-white mb-2">Select Prop</h3>
                <p className="text-sm text-zinc-400 mb-6">Browse your computer for an image.</p>
                <input
                  ref={customPropFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomPropUpload}
                  className="hidden"
                />
                <button
                  onClick={() => customPropFileRef.current?.click()}
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
                <h3 className="text-xl font-bold text-white mb-2">Paste Prop</h3>
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
    </div>
  );
}
