"use client";

import { useEffect, useRef, type ReactElement } from "react";

const FRAME_COUNT = 136;

function framePath(index: number): string {
  const n = String(index + 1).padStart(4, "0");
  return `/frames/frame_${n}.jpg`;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destWidth: number,
  destHeight: number,
): void {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  if (imgW === 0 || imgH === 0) return;

  const destRatio = destWidth / destHeight;
  const imgRatio = imgW / imgH;

  let sx = 0;
  let sy = 0;
  let sWidth = imgW;
  let sHeight = imgH;

  if (imgRatio > destRatio) {
    sWidth = imgH * destRatio;
    sx = (imgW - sWidth) / 2;
  } else {
    sHeight = imgW / destRatio;
    sy = (imgH - sHeight) / 2;
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, destWidth, destHeight);
}

/** Sfondo animato quando i JPG non sono disponibili: sfera scura → nucleo ciano/magenta */
function drawFallback(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
): void {
  const cx = w * 0.5;
  const cy = h * 0.48;
  const ease = t * t * (3 - 2 * t);
  const open = ease * 0.92;

  ctx.fillStyle = "#020204";
  ctx.fillRect(0, 0, w, h);

  const r0 = Math.max(w, h) * (0.08 + open * 0.55);
  const gCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, r0);
  gCore.addColorStop(0, `rgba(0, 240, 255, ${0.15 + open * 0.75})`);
  gCore.addColorStop(0.45, `rgba(255, 0, 229, ${0.08 + open * 0.45})`);
  gCore.addColorStop(1, "rgba(2, 2, 4, 0)");
  ctx.fillStyle = gCore;
  ctx.beginPath();
  ctx.arc(cx, cy, r0, 0, Math.PI * 2);
  ctx.fill();

  const shell = Math.max(w, h) * (0.35 + (1 - open) * 0.45);
  const gDark = ctx.createRadialGradient(cx, cy, shell * 0.2, cx, cy, shell);
  gDark.addColorStop(0, `rgba(5, 5, 12, ${0.2 + (1 - open) * 0.75})`);
  gDark.addColorStop(0.7, `rgba(26, 26, 34, ${0.35 * (1 - open)})`);
  gDark.addColorStop(1, "rgba(2, 2, 4, 0)");
  ctx.fillStyle = gDark;
  ctx.beginPath();
  ctx.arc(cx, cy, shell, 0, Math.PI * 2);
  ctx.fill();

  const edge = ctx.createLinearGradient(0, 0, w, h);
  edge.addColorStop(0, `rgba(0, 240, 255, ${0.02 + open * 0.12})`);
  edge.addColorStop(0.5, "rgba(5, 5, 10, 0)");
  edge.addColorStop(1, `rgba(255, 0, 229, ${0.02 + open * 0.12})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = `rgba(0, 240, 255, ${0.08 + open * 0.22})`;
  ctx.lineWidth = 1;
  const rings = 4;
  for (let i = 0; i < rings; i++) {
    const rr = r0 * (0.35 + (i / rings) * 0.5 * (0.3 + open));
    ctx.globalAlpha = 0.15 + open * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export default function FrameCanvas(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logicalSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const rafIdRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<number>(0);
  const imagesRef = useRef<Array<HTMLImageElement | undefined>>([]);
  const useImagesRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const images: Array<HTMLImageElement | undefined> = new Array(FRAME_COUNT);
    imagesRef.current = images;
    useImagesRef.current = false;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const drawFrame = (frameIndex: number): void => {
      const { w: lw, h: lh } = logicalSizeRef.current;
      if (lw === 0 || lh === 0) return;
      ctx.clearRect(0, 0, lw, lh);

      const useImages = useImagesRef.current;
      const img = images[frameIndex];
      if (useImages && img?.complete && img.naturalWidth > 0) {
        drawImageCover(ctx, img, lw, lh);
        return;
      }

      const t = frameIndex / (FRAME_COUNT - 1);
      drawFallback(ctx, lw, lh, t);
    };

    const scheduleDraw = (frameIndex: number): void => {
      pendingFrameRef.current = frameIndex;
      if (rafIdRef.current !== null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        drawFrame(pendingFrameRef.current);
      });
    };

    const resizeCanvas = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const logicalW = window.innerWidth;
      const logicalH = window.innerHeight;
      logicalSizeRef.current = { w: logicalW, h: logicalH };

      canvas.width = Math.floor(logicalW * dpr);
      canvas.height = Math.floor(logicalH * dpr);
      canvas.style.width = `${logicalW}px`;
      canvas.style.height = `${logicalH}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      drawFrame(pendingFrameRef.current);
    };

    const handleResize = (): void => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeCanvas();
        queueMicrotask(() => {
          void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
            ScrollTrigger.refresh();
          });
        });
      }, 200);
    };

    resizeCanvas();

    window.addEventListener("resize", handleResize);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
        img.src = src;
      });

    const loadFirstFrame = async (): Promise<void> => {
      try {
        const first = await loadImage(framePath(0));
        if (cancelled) return;
        images[0] = first;
        useImagesRef.current = true;
        scheduleDraw(0);
      } catch {
        useImagesRef.current = false;
        scheduleDraw(0);
      }
    };

    const loadRemainingBatches = (): void => {
      if (!useImagesRef.current) return;

      const idle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback
          : (cb: () => void) => window.setTimeout(cb, 1);

      idle(async () => {
        for (let start = 1; start < FRAME_COUNT; start += 10) {
          if (cancelled) return;
          const end = Math.min(FRAME_COUNT, start + 10);
          const batchPromises: Promise<void>[] = [];
          for (let i = start; i < end; i++) {
            batchPromises.push(
              (async (index: number) => {
                try {
                  const img = await loadImage(framePath(index));
                  if (!cancelled) images[index] = img;
                } catch (e) {
                  console.error(e);
                }
              })(i),
            );
          }
          await Promise.all(batchPromises);
          await new Promise<void>((r) => {
            setTimeout(() => r(), 30);
          });
        }
        queueMicrotask(() => {
          void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
            ScrollTrigger.refresh();
          });
        });
      });
    };

    let scrollTriggerKill: (() => void) | null = null;

    const initScroll = async (): Promise<void> => {
      const gsap = (await import("gsap")).default;
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (cancelled) return;

      const mainEl = document.querySelector("main#main");
      if (!mainEl) return;

      if (cancelled) return;

      const trigger = ScrollTrigger.create({
        trigger: mainEl,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onUpdate: (self) => {
          const frameIndex = Math.min(
            FRAME_COUNT - 1,
            Math.floor(self.progress * (FRAME_COUNT - 1)),
          );
          pendingFrameRef.current = frameIndex;
          scheduleDraw(frameIndex);
        },
      });

      scrollTriggerKill = () => {
        trigger.kill();
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ScrollTrigger.refresh();
        });
      });
    };

    void (async () => {
      await loadFirstFrame();
      loadRemainingBatches();
      await initScroll();
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      scrollTriggerKill?.();
      images.length = 0;
      imagesRef.current = [];
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] h-screen w-screen"
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        data-testid="omnia-frame-canvas"
      />
    </div>
  );
}
