/**
 * useSlideRecorder — Nimmt ein iframe-basiertes Slide als Video auf.
 * Zeichnet frameweise mit html2canvas den iframe-Body auf einen Canvas
 * und nutzt canvas.captureStream() + MediaRecorder für die Videoaufnahme.
 */
import { useState, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';

export function useSlideRecorder(iframeRef, duration = 10) {
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  const cancelRef = useRef(false);
  const recorderRef = useRef(null);
  const rafRef = useRef(null);
  const chunksRef = useRef([]);
  const startTimeRef = useRef(0);
  const mimeRef = useRef('video/webm');

  const isSupported = useCallback(() => {
    return typeof MediaRecorder !== 'undefined' &&
           typeof HTMLCanvasElement !== 'undefined' &&
           typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }, []);

  const startRecording = useCallback(async () => {
    if (!iframeRef.current) { setError('Iframe nicht gefunden'); return; }
    const doc = iframeRef.current.contentDocument;
    if (!doc?.body) { setError('Slide noch nicht geladen'); return; }

    // Reset state
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setRecording(true);
    setProgress(0);
    setError(null);
    cancelRef.current = false;
    chunksRef.current = [];

    try {
      // Capture canvas (full resolution)
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = 1080;
      captureCanvas.height = 1920;
      const ctx = captureCanvas.getContext('2d');

      // Fill initial frame
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, 1080, 1920);

      // MediaStream from canvas
      const stream = captureCanvas.captureStream(30);

      // Pick best supported mimeType
      const candidates = ['video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const mimeType = candidates.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || 'video/webm';
      mimeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setRecording(false);
        setProgress(1);
      };

      recorder.start(100); // collect data in 100ms chunks
      startTimeRef.current = Date.now();

      // Frame capture loop — html2canvas per frame, draw to capture canvas
      let lastFrameTime = 0;
      const captureFrame = async () => {
        if (cancelRef.current) return;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setProgress(Math.min(elapsed / duration, 1));

        if (elapsed >= duration) {
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
          }
          return;
        }

        // Only capture if at least 33ms since last frame (max 30fps)
        const now = performance.now();
        if (now - lastFrameTime >= 33) {
          lastFrameTime = now;
          try {
            const frameCanvas = await html2canvas(doc.body, {
              width: 1080, height: 1920, scale: 1,
              backgroundColor: '#050508', useCORS: true, logging: false,
            });
            ctx.fillStyle = '#050508';
            ctx.fillRect(0, 0, 1080, 1920);
            ctx.drawImage(frameCanvas, 0, 0, 1080, 1920);
          } catch (e) {
            // Skip frame on error (CORS, etc.)
          }
        }

        rafRef.current = requestAnimationFrame(captureFrame);
      };

      captureFrame();
    } catch (e) {
      setError(e.message || 'Aufnahme fehlgeschlagen');
      setRecording(false);
    }
  }, [iframeRef, duration, videoUrl]);

  const cancelRecording = useCallback(() => {
    cancelRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    if (videoUrl) { URL.revokeObjectURL(videoUrl); }
    setVideoUrl(null);
    setProgress(0);
    setError(null);
  }, [videoUrl]);

  return { recording, progress, videoUrl, error, isSupported, startRecording, cancelRecording, reset, mimeType: mimeRef.current };
}