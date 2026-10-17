'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crop,
  Film,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
  Check,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import type { MediaDto } from '@mehwar/shared';
import { cn } from '@/lib/cn';
import { uploadMedia } from '@/lib/media';

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export type AspectRatioOption = 'original' | '9:16' | '1:1' | '16:9' | '4:5';
export type TextPosition = 'top' | 'center' | 'bottom';
export type EditorTab = 'preview' | 'crop' | 'trim' | 'text' | 'audio';

interface VideoEditorModalProps {
  media: MediaDto | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  onSave?: (oldId: string, newMedia: MediaDto) => void;
}

const ASPECT_RATIOS: { id: AspectRatioOption; label: string; desc: string; ratio: number | null }[] = [
  { id: 'original', label: 'Original', desc: 'No crop', ratio: null },
  { id: '9:16', label: '9:16', desc: 'Reels / TikTok', ratio: 9 / 16 },
  { id: '1:1', label: '1:1', desc: 'Square feed', ratio: 1 },
  { id: '16:9', label: '16:9', desc: 'Landscape / YT', ratio: 16 / 9 },
  { id: '4:5', label: '4:5', desc: 'Portrait feed', ratio: 4 / 5 },
];

export function VideoEditorModal({
  media,
  onClose,
  onRemove,
  onSave,
}: VideoEditorModalProps) {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Editing state
  const [activeTab, setActiveTab] = useState<EditorTab>('preview');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('original');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [overlayText, setOverlayText] = useState('');
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom');
  const [isMutedOutput, setIsMutedOutput] = useState(false);

  // Export / processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState<string>('');

  useEffect(() => setMounted(true), []);

  // Reset editor state when media changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setActiveTab('preview');
    setAspectRatio('original');
    setTrimStart(0);
    setTrimEnd(0);
    setOverlayText('');
    setTextPosition('bottom');
    setIsMutedOutput(false);
    setIsProcessing(false);
    setProcessProgress(0);
  }, [media?.id]);

  // When duration is detected, set default trimEnd
  const handleDurationChange = (d: number) => {
    setDuration(d);
    setTrimEnd(d);
  };

  // Keyboard controls
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!media || isProcessing) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) void v.play();
        else v.pause();
      }
      if (e.key === 'm') {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
      }
    },
    [media, onClose, isProcessing],
  );

  useEffect(() => {
    if (!media) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [media, handleKey]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (trimEnd > 0 && v.currentTime >= trimEnd) {
        v.currentTime = trimStart;
      }
      void v.play();
    } else {
      v.pause();
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function restart() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = trimStart;
    void v.play();
  }

  function seekTo(fraction: number) {
    const v = videoRef.current;
    if (!v || !isFinite(duration) || duration <= 0) return;
    v.currentTime = Math.max(0, Math.min(duration, fraction * duration));
  }

  const getProgressFraction = useCallback((e: React.MouseEvent | MouseEvent) => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  function onProgressMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    seekTo(getProgressFraction(e));

    function onMove(ev: MouseEvent) {
      seekTo(getProgressFraction(ev));
    }
    function onUp() {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Handle trim loop preview
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);
    if (activeTab === 'trim' && trimEnd > trimStart && time >= trimEnd) {
      e.currentTarget.currentTime = trimStart;
    }
  };

  // Check if any edits have been applied
  const hasEdits = useMemo(() => {
    const isTrimmed = trimStart > 0.1 || (duration > 0 && trimEnd < duration - 0.2);
    const isCropped = aspectRatio !== 'original';
    const hasText = overlayText.trim().length > 0;
    const audioChanged = isMutedOutput;
    return isTrimmed || isCropped || hasText || audioChanged;
  }, [trimStart, trimEnd, duration, aspectRatio, overlayText, isMutedOutput]);

  /**
   * Export the edited video directly in the browser using HTML5 Canvas & MediaRecorder
   */
  async function handleExportAndSave() {
    if (!media?.url || isProcessing) return;

    const sourceVideo = videoRef.current;
    if (!sourceVideo) return;

    setIsProcessing(true);
    setProcessProgress(0.05);
    setProcessStatus('Preparing video export…');

    try {
      // 1. Create offline video element with crossOrigin
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.src = media.url;
      v.preload = 'auto';
      v.muted = isMutedOutput;

      await new Promise<void>((resolve, reject) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => reject(new Error('Failed to load video stream for export'));
      });

      const videoDuration = v.duration || duration || media.durationSec || 10;
      const effectiveStart = Math.max(0, trimStart);
      const effectiveEnd = trimEnd > effectiveStart ? Math.min(trimEnd, videoDuration) : videoDuration;
      const exportDuration = Math.max(0.5, effectiveEnd - effectiveStart);

      // Determine dimensions
      const origW = v.videoWidth || 1280;
      const origH = v.videoHeight || 720;
      const selectedAspect = ASPECT_RATIOS.find((a) => a.id === aspectRatio);

      let targetW = origW;
      let targetH = origH;
      let sx = 0;
      let sy = 0;
      let sWidth = origW;
      let sHeight = origH;

      if (selectedAspect && selectedAspect.ratio !== null) {
        const targetRatio = selectedAspect.ratio;
        const currentRatio = origW / origH;

        if (currentRatio > targetRatio) {
          // Crop width
          sWidth = Math.round(origH * targetRatio);
          sHeight = origH;
          sx = Math.round((origW - sWidth) / 2);
          sy = 0;
        } else {
          // Crop height
          sWidth = origW;
          sHeight = Math.round(origW / targetRatio);
          sx = 0;
          sy = Math.round((origH - sHeight) / 2);
        }

        // Cap target dimensions to max 1080p for fast encoding
        const maxDim = 1280;
        if (sWidth > sHeight) {
          targetW = Math.min(sWidth, maxDim);
          targetH = Math.round(targetW / targetRatio);
        } else {
          targetH = Math.min(sHeight, maxDim);
          targetW = Math.round(targetH * targetRatio);
        }
      }

      // Ensure even dimensions for video codecs
      targetW = targetW % 2 === 0 ? targetW : targetW - 1;
      targetH = targetH % 2 === 0 ? targetH : targetH - 1;

      // 2. Setup Canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      // 3. Audio & Stream capture
      // @ts-expect-error captureStream exists on HTMLCanvasElement in modern browsers
      const canvasStream: MediaStream = canvas.captureStream ? canvas.captureStream(30) : canvas.mozCaptureStream(30);

      if (!isMutedOutput) {
        try {
          // @ts-expect-error captureStream on HTMLVideoElement
          const videoStream: MediaStream | null = v.captureStream ? v.captureStream() : v.mozCaptureStream ? v.mozCaptureStream() : null;
          if (videoStream && videoStream.getAudioTracks().length > 0) {
            canvasStream.addTrack(videoStream.getAudioTracks()[0]!);
          }
        } catch {
          // Fallback if cross-origin audio track is blocked
        }
      }

      // 4. MediaRecorder setup
      const mimeTypes = [
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const selectedMime = mimeTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || 'video/webm';

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 4_000_000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      setProcessStatus('Rendering frames…');
      v.currentTime = effectiveStart;
      await new Promise<void>((r) => {
        v.onseeked = () => r();
      });

      // 5. Render loop
      let animId: number;
      const renderPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: selectedMime.split(';')[0] }));
        };

        recorder.start(100);
        void v.play();

        function drawFrame() {
          if (!ctx) return;

          // Draw cropped video frame
          ctx.drawImage(v, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);

          // Draw Text Overlay if present
          const text = overlayText.trim();
          if (text) {
            ctx.save();
            const fontSize = Math.max(18, Math.round(targetH * 0.045));
            ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textX = targetW / 2;
            let textY = targetH * 0.5;
            if (textPosition === 'top') textY = targetH * 0.14;
            if (textPosition === 'bottom') textY = targetH * 0.86;

            const metrics = ctx.measureText(text);
            const padX = fontSize * 0.8;
            const padY = fontSize * 0.45;
            const pillW = metrics.width + padX * 2;
            const pillH = fontSize + padY * 2;

            // Translucent rounded badge background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(textX - pillW / 2, textY - pillH / 2, pillW, pillH, pillH / 2);
            } else {
              ctx.rect(textX - pillW / 2, textY - pillH / 2, pillW, pillH);
            }
            ctx.fill();

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, textX, textY);
            ctx.restore();
          }

          // Progress
          const elapsed = Math.max(0, v.currentTime - effectiveStart);
          const ratio = Math.min(1, elapsed / exportDuration);
          setProcessProgress(0.1 + ratio * 0.5);

          if (v.currentTime >= effectiveEnd || v.ended) {
            cancelAnimationFrame(animId);
            v.pause();
            recorder.stop();
          } else {
            animId = requestAnimationFrame(drawFrame);
          }
        }

        animId = requestAnimationFrame(drawFrame);
      });

      const outputBlob = await renderPromise;

      // 6. Upload new edited video
      setProcessStatus('Uploading edited video…');
      const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
      const cleanName = (media.fileName.replace(/\.[^/.]+$/, '') || 'video') + `-edited.${ext}`;
      const newFile = new File([outputBlob], cleanName, { type: outputBlob.type });

      const uploadedMedia = await uploadMedia(newFile, (prog) => {
        setProcessProgress(0.6 + prog * 0.4);
      });

      toast.success('Video updated ✨', {
        description: 'Your edited video is ready and saved.',
      });

      if (onSave) {
        onSave(media.id, uploadedMedia);
      }
      onClose();
    } catch (err) {
      console.error('Video edit failed:', err);
      toast.error('Could not export video', {
        description: err instanceof Error ? err.message : 'Please check video format or storage settings.',
      });
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
      setProcessStatus('');
    }
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const open = !!media;
  const videoUrl = media?.url ?? null;
  const videoName = media?.fileName ?? 'Video';
  const videoDuration = media?.durationSec ?? duration;

  // Selected aspect ratio object
  const currentAspect = ASPECT_RATIOS.find((a) => a.id === aspectRatio);

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isProcessing) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Video editor: ${videoName}`}
            className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c18] text-white shadow-2xl max-h-[92vh]"
            initial={{ y: 25, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 25, opacity: 0, scale: 0.97 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="brand-gradient flex size-8 shrink-0 items-center justify-center rounded-xl shadow-md">
                  <Film className="size-4 text-white" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-white/95">{videoName}</h3>
                  <div className="flex items-center gap-2 text-[11px] text-white/50">
                    <span>{formatTime(videoDuration)}</span>
                    {hasEdits && (
                      <span className="flex items-center gap-1 text-fuchsia-400 font-medium">
                        <Sparkles className="size-3" /> Edited
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mode switch tabs */}
              <div className="hidden sm:flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                {[
                  { id: 'preview', label: 'Preview', icon: Play },
                  { id: 'crop', label: 'Crop', icon: Crop },
                  { id: 'trim', label: 'Trim', icon: Scissors },
                  { id: 'text', label: 'Text', icon: Type },
                  { id: 'audio', label: 'Audio', icon: Volume2 },
                ].map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id as EditorTab)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'brand-gradient text-white shadow-sm'
                          : 'text-white/60 hover:text-white hover:bg-white/5',
                      )}
                    >
                      <Icon className="size-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isProcessing}
                onClick={onClose}
                className="shrink-0 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mobile tabs row */}
            <div className="flex sm:hidden overflow-x-auto border-b border-white/10 px-4 py-2 gap-1.5">
              {[
                { id: 'preview', label: 'Preview', icon: Play },
                { id: 'crop', label: 'Crop', icon: Crop },
                { id: 'trim', label: 'Trim', icon: Scissors },
                { id: 'text', label: 'Text', icon: Type },
                { id: 'audio', label: 'Audio', icon: Volume2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as EditorTab)}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition',
                      active
                        ? 'brand-gradient text-white shadow-sm'
                        : 'text-white/60 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <Icon className="size-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Main Stage: Video Viewport & Controls */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative flex min-h-[280px] max-h-[50vh] sm:max-h-[55vh] items-center justify-center bg-black/90 p-4">
                {/* Viewport Frame with Aspect Ratio constraint */}
                <div
                  className="relative flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl transition-all duration-300"
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    aspectRatio: currentAspect?.ratio ? `${currentAspect.ratio}` : undefined,
                  }}
                  onClick={togglePlay}
                >
                  {videoUrl ? (
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className={cn(
                        'max-h-[50vh] sm:max-h-[55vh] object-contain',
                        currentAspect?.ratio && 'size-full object-cover',
                      )}
                      playsInline
                      preload="metadata"
                      onTimeUpdate={handleTimeUpdate}
                      onDurationChange={(e) => handleDurationChange(e.currentTarget.duration)}
                      onEnded={() => setPlaying(false)}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-white/40">
                      <Film className="size-12" />
                      <p className="text-sm">Video loading…</p>
                    </div>
                  )}

                  {/* Real-time Text Overlay preview on video */}
                  {overlayText.trim() && (
                    <motion.div
                      layout
                      className={cn(
                        'pointer-events-none absolute left-0 right-0 flex justify-center px-4',
                        textPosition === 'top' && 'top-6',
                        textPosition === 'center' && 'top-1/2 -translate-y-1/2',
                        textPosition === 'bottom' && 'bottom-6',
                      )}
                    >
                      <span className="rounded-2xl bg-black/75 px-4 py-2 text-center text-sm sm:text-base font-bold text-white shadow-2xl backdrop-blur-md">
                        {overlayText}
                      </span>
                    </motion.div>
                  )}

                  {/* Play Overlay (shown when paused) */}
                  <AnimatePresence>
                    {videoUrl && !playing && !isProcessing && (
                      <motion.div
                        key="play-overlay"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <div className="flex size-14 items-center justify-center rounded-full border border-white/20 bg-black/60 shadow-2xl backdrop-blur-md">
                          <Play className="size-6 translate-x-0.5 text-white" fill="currentColor" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Processing / Export progress overlay */}
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 backdrop-blur-md"
                      >
                        <Loader2 className="size-8 animate-spin text-fuchsia-400" />
                        <span className="text-sm font-semibold text-white/90">{processStatus}</span>
                        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
                          <motion.div
                            className="h-full brand-gradient"
                            animate={{ width: `${Math.round(processProgress * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-white/60">
                          {Math.round(processProgress * 100)}%
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Scrubber & Playback bar */}
              <div className="border-b border-white/10 bg-[#0c0c18] px-5 py-3">
                {videoUrl && (
                  <div
                    ref={progressBarRef}
                    role="slider"
                    aria-label="Seek video"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    tabIndex={0}
                    className={cn(
                      'group relative h-1.5 w-full cursor-pointer rounded-full bg-white/15 transition-transform',
                      dragging && 'scale-y-150',
                    )}
                    onMouseDown={onProgressMouseDown}
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full brand-gradient"
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.05, ease: 'linear' }}
                    />
                    <div
                      className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white shadow-md opacity-0 transition group-hover:opacity-100"
                      style={{ left: `${progress * 100}%` }}
                    />
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                      aria-label={playing ? 'Pause' : 'Play'}
                    >
                      {playing ? (
                        <Pause className="size-3.5" fill="currentColor" />
                      ) : (
                        <Play className="size-3.5 translate-x-px" fill="currentColor" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={restart}
                      className="flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                      aria-label="Restart"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      className="flex size-8 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                      aria-label={muted ? 'Unmute' : 'Mute'}
                    >
                      {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                    </button>

                    <span className="ml-1 text-[11px] tabular-nums text-white/50">
                      {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration || videoDuration)}
                    </span>
                  </div>

                  {/* Active tab summary badge */}
                  <div className="text-[11px] font-semibold text-white/40">
                    {activeTab === 'crop' && `Aspect: ${currentAspect?.label}`}
                    {activeTab === 'trim' &&
                      `Trim: ${formatTime(trimStart)} – ${formatTime(trimEnd || duration)}`}
                    {activeTab === 'text' && (overlayText ? `Text: "${overlayText}"` : 'No text')}
                    {activeTab === 'audio' && (isMutedOutput ? 'Audio muted' : 'Audio on')}
                  </div>
                </div>
              </div>

              {/* Editing Controls Panels (Tabs) */}
              <div className="p-5">
                {/* 1. PREVIEW TAB */}
                {activeTab === 'preview' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Video Information & Controls
                    </h4>
                    <p className="text-xs text-white/60 leading-relaxed">
                      Use the tabs above to crop to social media dimensions, trim the length, or add
                      a text overlay before posting.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('crop')}
                        className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        <Crop className="size-3.5 text-fuchsia-400" />
                        Crop aspect ratio
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('trim')}
                        className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        <Scissors className="size-3.5 text-fuchsia-400" />
                        Trim length
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('text')}
                        className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        <Type className="size-3.5 text-fuchsia-400" />
                        Add text overlay
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. CROP / FORMAT TAB */}
                {activeTab === 'crop' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Choose Format / Aspect Ratio
                      </h4>
                      <span className="text-xs text-white/40">Real-time viewfinder preview</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {ASPECT_RATIOS.map((opt) => {
                        const selected = aspectRatio === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAspectRatio(opt.id)}
                            className={cn(
                              'flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition',
                              selected
                                ? 'border-fuchsia-500 bg-fuchsia-500/15 ring-2 ring-fuchsia-500/30'
                                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
                            )}
                          >
                            <span className="text-xs font-bold text-white flex items-center justify-between w-full">
                              {opt.label}
                              {selected && <Check className="size-3 text-fuchsia-400" />}
                            </span>
                            <span className="text-[10px] text-white/50">{opt.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. TRIM TAB */}
                {activeTab === 'trim' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Trim Video Duration
                      </h4>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-400">
                        Duration: {formatTime(Math.max(0, (trimEnd || duration) - trimStart))}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Start Time */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white/80">Start Time</span>
                          <span className="font-bold tabular-nums text-fuchsia-400">
                            {formatTime(trimStart)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, (trimEnd || duration) - 0.5)}
                          step={0.1}
                          value={trimStart}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTrimStart(val);
                            if (videoRef.current) videoRef.current.currentTime = val;
                          }}
                          className="w-full accent-fuchsia-500 cursor-pointer"
                        />
                      </div>

                      {/* End Time */}
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white/80">End Time</span>
                          <span className="font-bold tabular-nums text-fuchsia-400">
                            {formatTime(trimEnd || duration)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={trimStart + 0.5}
                          max={duration || 10}
                          step={0.1}
                          value={trimEnd || duration}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTrimEnd(val);
                            if (videoRef.current) videoRef.current.currentTime = val;
                          }}
                          className="w-full accent-fuchsia-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = trimStart;
                            void videoRef.current.play();
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                      >
                        <Play className="size-3" fill="currentColor" />
                        Preview Trimmed Section
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(duration);
                        }}
                        className="text-xs text-white/40 hover:text-white transition"
                      >
                        Reset to full
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. TEXT OVERLAY TAB */}
                {activeTab === 'text' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Add Text Overlay
                    </h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        placeholder="e.g. Must watch! 🔥 or Check this out..."
                        maxLength={80}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
                      />

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-semibold text-white/60 mr-1">Position:</span>
                        {(['top', 'center', 'bottom'] as TextPosition[]).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setTextPosition(pos)}
                            className={cn(
                              'rounded-full px-3 py-1 text-xs font-semibold capitalize transition',
                              textPosition === pos
                                ? 'brand-gradient text-white shadow-sm'
                                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                            )}
                          >
                            {pos}
                          </button>
                        ))}

                        {overlayText && (
                          <button
                            type="button"
                            onClick={() => setOverlayText('')}
                            className="ml-auto text-xs text-red-400 hover:text-red-300"
                          >
                            Clear text
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. AUDIO TAB */}
                {activeTab === 'audio' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Audio Settings
                    </h4>
                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-white">Mute original audio</div>
                        <div className="text-xs text-white/50">
                          Export the edited video completely silent
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMutedOutput(!isMutedOutput)}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                          isMutedOutput ? 'brand-gradient' : 'bg-white/20',
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                            isMutedOutput ? 'translate-x-5' : 'translate-x-0',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-white/10 bg-[#0c0c18] px-5 py-4">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  if (media) {
                    onRemove(media.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/15 disabled:opacity-40"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={onClose}
                  className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isProcessing || !videoUrl}
                  onClick={handleExportAndSave}
                  className="brand-gradient flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      {hasEdits ? 'Save & Apply Edits' : 'Done'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
