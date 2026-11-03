import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** กล้องหลังของมือถือ อ่าน QR ทุกเฟรมด้วย jsQR แล้วเรียก onResult ครั้งเดียว */
export function QrCamera({ onResult, onError }: { onResult: (text: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let done = false;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (done || !video || !canvas) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        const scale = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            done = true;
            onResult(code.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (done) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        frame = requestAnimationFrame(tick);
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError';
        onError(denied
          ? 'ยังไม่ได้อนุญาตกล้อง เปิดสิทธิ์กล้องให้เว็บนี้ หรือสแกนด้วยแอปกล้องของมือถือแทน'
          : 'เปิดกล้องไม่ได้ ลองสแกนด้วยแอปกล้องของมือถือแทน');
      }
    })();

    return () => {
      done = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onResult, onError]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-black neon-img">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-[var(--app-accent)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      {!ready && <p role="status" className="absolute inset-0 grid place-items-center text-sm text-white">กำลังเปิดกล้อง...</p>}
    </div>
  );
}
