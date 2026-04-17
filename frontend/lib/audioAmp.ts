"use client";

import { useEffect } from "react";

export interface Amp {
  bass: number;
  mid: number;
  high: number;
  overall: number;
}

export function createAmp(): Amp {
  return { bass: 0, mid: 0, high: 0, overall: 0 };
}

/**
 * Connect a Web Audio analyser to the audio element and write smoothed
 * amplitude values into `ampRef.current` every animation frame.
 *
 * Called once `playing` is true so we don't init AudioContext on a tab
 * the user never interacts with (browsers warn / refuse).
 */
export function useAudioAmp(
  audioRef: React.RefObject<HTMLAudioElement>,
  ampRef: React.MutableRefObject<Amp>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const el = audioRef.current;
    if (!el) return;

    const W = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctx = W.AudioContext || W.webkitAudioContext;
    if (!Ctx) return;

    let ctx: AudioContext;
    try {
      ctx = new Ctx();
    } catch {
      return;
    }

    let source: MediaElementAudioSourceNode;
    try {
      source = ctx.createMediaElementSource(el);
    } catch {
      // already connected — happens with hot-reload. bail.
      ctx.close();
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const loop = () => {
      analyser.getByteFrequencyData(data);
      // crude bands — fft 256 → 128 bins → split bass/mid/high
      let bs = 0, md = 0, hi = 0, all = 0;
      const bsEnd = 8;
      const mdEnd = 40;
      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 255;
        all += v;
        if (i < bsEnd) bs += v;
        else if (i < mdEnd) md += v;
        else hi += v;
      }
      ampRef.current.bass = bs / bsEnd;
      ampRef.current.mid = md / (mdEnd - bsEnd);
      ampRef.current.high = hi / (data.length - mdEnd);
      ampRef.current.overall = all / data.length;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
        analyser.disconnect();
        ctx.close();
      } catch {
        /* noop */
      }
    };
  }, [audioRef, ampRef, enabled]);
}
