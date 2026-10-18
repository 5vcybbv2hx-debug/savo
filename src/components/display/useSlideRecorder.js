/**
 * useSlideRecorder — Nimmt eine TV-Slide als Video auf.
 *
 * PRIMÄRE METHODE (HD): navigator.mediaDevices.getDisplayMedia + CropTarget
 *   - 30 fps, korrekte CSS-Rendering (Shimmer, Glow, background-clip:text)
 *   - CropTarget.fromElement cropt auf den iframe (9:16)
 *   - Der iframe wird während der Aufnahme auf volle 1080×1920 gesetzt
 *
 * FALLBACK: html2canvas pro Frame → canvas.captureStream
 *   - ~8 fps, 6 s Dauer, ehrlich als "Vereinfachte Aufnahme" ausgewiesen
 *   - Nur wenn getDisplayMedia nicht verfügbar (Safari, mobile)
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';

export function useSlideRecorder({ iframeRef, duration = 10 }) {
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [activeMethod, setActiveMethod] = useState(null); // 'hd' | 'fallback'

  const cancelRef = useRef(false);
  const recorderRef = useRef(null);
  const rafRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const mimeRef = useRef('video/webm');
  const stopTimerRef = useRef(null);
  const savedStyleRef = useRef(null);
  const videoUrlRef = useRef(null);

  // ── Methoden-Erkennung ──────────────────────────────────────────────────
  const availableMethod = useMemo(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) return 'hd';
    if (typeof MediaRecorder !== 'undefined' &&
        typeof HTMLCanvasElement !== 'undefined' &&
        typeof HTMLCanvasElement.prototype.captureStream === 'function') return 'fallback';
    return 'none';
  }, []);

  const hasCropTarget = typeof CropTarget !== 'undefined';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pickMimeType = useCallback(() => {
    const c = ['video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return c.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || 'video/webm';
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const restoreIframe = useCallback(() => {
    const f = iframeRef.current;
    if (f && savedStyleRef.current) {
      const s = savedStyleRef.current;
      f.style.position = s.position; f.style.transform = s.transform; f.style.transformOrigin = s.transformOrigin;
      f.style.top = s.top; f.style.left = s.left; f.style.width = s.width; f.style.height = s.height; f.style.zIndex = s.zIndex;
      savedStyleRef.current = null;
    }
  }, [iframeRef]);

  // ── HD-Aufnahme (getDisplayMedia + CropTarget) ──────────────────────────
  const startHDRecording = useCallback(async () => {
    const f = iframeRef.current;
    if (!f) { setError('Slide nicht gefunden'); setRecording(false); return; }

    // iframe auf volle Größe bringen für hochauflösende Aufnahme
    savedStyleRef.current = {
      position: f.style.position, transform: f.style.transform, transformOrigin: f.style.transformOrigin,
      top: f.style.top, left: f.style.left, width: f.style.width, height: f.style.height, zIndex: f.style.zIndex,
    };
    f.style.position = 'fixed'; f.style.transform = 'none'; f.style.transformOrigin = 'top left';
    f.style.top = '0'; f.style.left = '0'; f.style.width = '1080px'; f.style.height = '1920px'; f.style.zIndex = '999998';

    // Zwei RAF warten bis das Layout sicher steht
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      // getDisplayMedia — preferCurrentTab + selfBrowserSurface für aktuellen Tab
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 }, preferCurrentTab: true, selfBrowserSurface: 'include',
        });
      } catch {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, preferCurrentTab: true });
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];

      // CropTarget: schneidet auf den iframe zu
      if (hasCropTarget) {
        try {
          const ct = await CropTarget.fromElement(f);
          await track.cropTo(ct);
        } catch (e) { console.warn('CropTarget fehlgeschlagen, nehme vollen Tab auf:', e); }
      }

      mimeRef.current = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: mimeRef.current, videoBitsPerSecond: 8000000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url); setRecording(false); setProgress(1);
        cleanupStream(); restoreIframe();
      };

      recorder.start(100);
      const start = Date.now();
      const tick = () => {
        if (cancelRef.current) return;
        const el = (Date.now() - start) / 1000;
        setProgress(Math.min(el / duration, 1));
        if (el >= duration) { if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      stopTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop();
      }, duration * 1000);

      // User stoppt die Freigabe über die Browser-UI
      track.onended = () => { if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop(); };
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? 'Freigabe abgelehnt — bitte diesen Tab erlauben' : (e?.message || 'Aufnahme fehlgeschlagen'));
      setRecording(false); cleanupStream(); restoreIframe();
    }
  }, [iframeRef, hasCropTarget, duration, pickMimeType, cleanupStream, restoreIframe]);

  // ── Fallback-Aufnahme (html2canvas, 8 fps, 6 s) ──────────────────────────
  const startFallbackRecording = useCallback(async () => {
    if (!iframeRef.current) { setError('Slide nicht gefunden'); setRecording(false); return; }
    const doc = iframeRef.current.contentDocument;
    if (!doc?.body) { setError('Slide noch nicht geladen'); setRecording(false); return; }

    const fd = 6; // 6 Sekunden
    try {
      const cc = document.createElement('canvas'); cc.width = 1080; cc.height = 1920;
      const ctx = cc.getContext('2d'); ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, 1080, 1920);
      const stream = cc.captureStream(8); streamRef.current = stream;
      mimeRef.current = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: mimeRef.current, videoBitsPerSecond: 4000000 });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url); setRecording(false); setProgress(1); cleanupStream();
      };

      recorder.start(100);
      const start = Date.now(); let lastF = 0;
      const tick = async () => {
        if (cancelRef.current) return;
        const el = (Date.now() - start) / 1000;
        setProgress(Math.min(el / fd, 1));
        if (el >= fd) { if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop(); return; }
        const now = performance.now();
        if (now - lastF >= 125) { // 8 fps
          lastF = now;
          try {
            const fc = await html2canvas(doc.body, { width: 1080, height: 1920, scale: 1, backgroundColor: '#050508', useCORS: true, logging: false });
            ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, 1080, 1920); ctx.drawImage(fc, 0, 0, 1080, 1920);
          } catch { /* skip frame */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      stopTimerRef.current = setTimeout(() => { if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop(); }, fd * 1000);
    } catch (e) { setError(e?.message || 'Aufnahme fehlgeschlagen'); setRecording(false); cleanupStream(); }
  }, [iframeRef, pickMimeType, cleanupStream]);

  // ── Public API ───────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (videoUrlRef.current) { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = null; }
    setVideoUrl(null); setRecording(true); setProgress(0); setError(null);
    cancelRef.current = false; chunksRef.current = [];

    if (availableMethod === 'hd') { setActiveMethod('hd'); await startHDRecording(); }
    else if (availableMethod === 'fallback') { setActiveMethod('fallback'); await startFallbackRecording(); }
    else { setError('Videoaufnahme wird in diesem Browser nicht unterstützt'); setRecording(false); }
  }, [availableMethod, startHDRecording, startFallbackRecording]);

  const cancelRecording = useCallback(() => {
    cancelRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop();
    cleanupStream();
  }, [cleanupStream]);

  const reset = useCallback(() => {
    if (videoUrlRef.current) { URL.revokeObjectURL(videoUrlRef.current); videoUrlRef.current = null; }
    setVideoUrl(null); setProgress(0); setError(null); setActiveMethod(null);
  }, []);

  // Track videoUrl in ref for cleanup
  useEffect(() => { videoUrlRef.current = videoUrl; }, [videoUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupStream(); restoreIframe(); if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current); };
  }, []);

  const fallbackDuration = 6;

  return {
    recording, progress, videoUrl, error,
    availableMethod, activeMethod, hasCropTarget,
    startRecording, cancelRecording, reset,
    mimeType: mimeRef.current,
    hdDuration: duration,
    fallbackDuration,
  };
}