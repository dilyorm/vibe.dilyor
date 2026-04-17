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
 * Single audio-graph hook:
 *   source → lowpass filter → [dry gain → destination]
 *                           → [convolver → wet gain → destination]
 * plus an analyser tap off the source feeding `ampRef`.
 *
 * `remixRef.current.on` drives a smooth crossfade between a transparent
 * mix (filter wide open, wet gain 0) and a muffled, reverberant mix
 * (filter ~420 Hz, wet gain ~0.55). Set it from UI hold handlers.
 */
export interface RemixState {
  on: boolean;
}

export function createRemix(): RemixState {
  return { on: false };
}

export function useAudio(
  audioRef: React.RefObject<HTMLAudioElement>,
  ampRef: React.MutableRefObject<Amp>,
  remixRef: React.MutableRefObject<RemixState>,
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
      ctx.close();
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 22000;
    filter.Q.value = 0.7;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0;

    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulseResponse(ctx, 2.4, 2.8);

    // source → analyser tap (pure monitor, not fed to destination)
    source.connect(analyser);

    // source → filter → dry+wet → destination
    source.connect(filter);
    filter.connect(dryGain).connect(ctx.destination);
    filter.connect(convolver).connect(wetGain).connect(ctx.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const loop = () => {
      analyser.getByteFrequencyData(data);
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

      // smooth-crossfade remix state
      const now = ctx.currentTime;
      const targetFreq = remixRef.current.on ? 420 : 22000;
      const targetWet = remixRef.current.on ? 0.55 : 0;
      const targetDry = remixRef.current.on ? 0.65 : 1.0;
      filter.frequency.linearRampToValueAtTime(targetFreq, now + 0.25);
      wetGain.gain.linearRampToValueAtTime(targetWet, now + 0.25);
      dryGain.gain.linearRampToValueAtTime(targetDry, now + 0.25);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
        analyser.disconnect();
        filter.disconnect();
        dryGain.disconnect();
        wetGain.disconnect();
        convolver.disconnect();
        ctx.close();
      } catch {
        /* noop */
      }
    };
  }, [audioRef, ampRef, remixRef, enabled]);
}

/** Generate a short exponentially-decaying noise impulse — cheap plate-reverb feel. */
function makeImpulseResponse(
  ctx: AudioContext,
  durationSec: number,
  decay: number,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * durationSec);
  const buf = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

