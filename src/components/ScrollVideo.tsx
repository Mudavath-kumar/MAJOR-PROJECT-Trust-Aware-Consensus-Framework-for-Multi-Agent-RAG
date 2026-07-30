import { useEffect, useRef, useState } from "react";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260729_102822_0e6c87e8-c141-4744-bf32-ad30db296371.mp4";

/**
 * Full-bleed background video whose timeline is scrubbed by page scroll.
 * Poster -> video -> canvas (cached frames) crossfade.
 */
export function ScrollVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const [hasFrame, setHasFrame] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let raf = 0;
    let smoothed = 0;
    let disposed = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawCover = (source: CanvasImageSource, sw: number, sh: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx || !sw || !sh) return;
      const scale = Math.max(canvas.width / sw, canvas.height / sh);
      const w = sw * scale;
      const h = sh * scale;
      ctx.drawImage(source, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };

    const onLoadedData = () => setHasFrame(true);
    video.addEventListener("loadeddata", onLoadedData);

    const tick = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      smoothed += (target - smoothed) * 0.12;

      const frames = framesRef.current;
      if (frames.length > 0) {
        const idx = Math.min(frames.length - 1, Math.round(smoothed * (frames.length - 1)));
        const bmp = frames[idx];
        if (bmp) drawCover(bmp, bmp.width, bmp.height);
      } else if (video.readyState >= 2 && video.duration) {
        const t = smoothed * (video.duration - 0.05);
        if (Math.abs(video.currentTime - t) > 0.04) video.currentTime = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Build a frame cache from an offscreen copy for smooth scrubbing.
    const buildCache = async () => {
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) resolve();
        else video.addEventListener("loadeddata", () => resolve(), { once: true });
      });
      await new Promise((r) => setTimeout(r, 300));
      if (disposed) return;

      const off = document.createElement("video");
      off.src = VIDEO_SRC;
      off.crossOrigin = "anonymous";
      off.muted = true;
      off.playsInline = true;
      off.preload = "auto";
      try {
        await new Promise<void>((resolve, reject) => {
          off.addEventListener("loadeddata", () => resolve(), { once: true });
          off.addEventListener("error", () => reject(new Error("load")), { once: true });
        });
        const duration = off.duration;
        if (!duration || !isFinite(duration)) return;
        const count = Math.max(24, Math.min(90, Math.floor(duration * 12)));
        const sw = Math.min(960, off.videoWidth || 960);
        const sh = Math.round((sw / (off.videoWidth || 960)) * (off.videoHeight || 540));
        const tmp = document.createElement("canvas");
        tmp.width = sw;
        tmp.height = sh;
        const tctx = tmp.getContext("2d");
        if (!tctx) return;

        const out: ImageBitmap[] = [];
        for (let i = 0; i < count; i++) {
          if (disposed) return;
          const t = (i / (count - 1)) * (duration - 0.05);
          await new Promise<void>((resolve) => {
            off.addEventListener("seeked", () => resolve(), { once: true });
            off.currentTime = t;
          });
          tctx.drawImage(off, 0, 0, sw, sh);
          out.push(await createImageBitmap(tmp));
        }
        if (disposed) return;
        framesRef.current = out;
        setCacheReady(true);
      } catch {
        /* fall back to live seeking */
      }
    };
    void buildCache();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      video.removeEventListener("loadeddata", onLoadedData);
      framesRef.current.forEach((b) => b.close?.());
      framesRef.current = [];
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#0a0a0a]">
      <img
        src="/hero-poster.jpg"
        alt=""
        aria-hidden
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          hasFrame ? "opacity-0" : "opacity-100"
        }`}
      />
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          hasFrame && !cacheReady ? "opacity-100" : "opacity-0"
        }`}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
          cacheReady ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="absolute inset-0 bg-[#0a0a0a]/35" />
    </div>
  );
}