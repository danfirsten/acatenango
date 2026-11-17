'use client';

import { useEffect, useRef, useState } from 'react';

import Hoop from '@/components/ink/Hoop';
import ImageTag from '@/components/ink/ImageTag';
import { formatNumber, formatShortDate, getDict, type Locale } from '@/i18n';
import type { IndexEntry } from '../../scripts/build-index';
import {
  type LabelPosition,
  type MassifHandle,
  type MassifMeta,
  createMassifScene,
  loadHeightfield,
} from '@/lib/scene/massif';
import { MASSIF_JSON_URL, MASSIF_PNG_URL } from '@/lib/terrain';

interface MassifProps {
  /** The archived day the scene should draw. */
  day: IndexEntry;
  locale: Locale;
}

/** Room a summit label needs to the right of its dot, in CSS pixels. */
const LABEL_ROOM = 176;
/** Half the height of a summit label's two lines, in CSS pixels. */
const LABEL_HALF = 16;
/** Room the summit dot needs clear of other words, in CSS pixels. */
const DOT_CLEAR = 4;
/** The band along the bottom of the scene that the image tag and the switch sit in. */
const CONTROLS_BAND = 52;

/** Whether a label hangs to the left of its dot, near the right edge. */
const hangsLeft = (l: LabelPosition) => l.roomRight < LABEL_ROOM;
/** The stretch of the scene a label's words can take, left to right. */
const wordsSpan = (l: LabelPosition): [number, number] => (hangsLeft(l) ? [l.x - LABEL_ROOM, l.x] : [l.x, l.x + LABEL_ROOM]);

/** A summit label, with how far its words move up (negative) or down from its dot. */
export type PlacedLabel = LabelPosition & { shift: number };

/**
 * Moves summit labels' words, never their dots, so no words sit on the scene's
 * controls or on each other. A label whose words would reach the controls along
 * the bottom hangs them above its dot. When two summits land side by side, the
 * higher one's words go above its dot and the lower one's go below the higher
 * dot. The dots stay on their summits. A summit so low that even words above
 * its dot would reach the controls (or the clip's edge) is not labelled.
 */
export function placeLabels(input: LabelPosition[], height: number): PlacedLabel[] {
  const above = -(LABEL_HALF + DOT_CLEAR);
  const labels = input.map((l) => (l.visible && l.y + LABEL_HALF - DOT_CLEAR > height - CONTROLS_BAND ? { ...l, visible: false } : l));
  const shift: Record<string, number> = {};
  for (const l of labels) {
    if (l.visible && l.y + 2 * LABEL_HALF > height - CONTROLS_BAND) shift[l.key] = above;
  }
  const shown = labels.filter((l) => l.visible).sort((a, b) => a.y - b.y);
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      const [up, down] = [shown[i], shown[j]];
      const [u, d] = [wordsSpan(up), wordsSpan(down)];
      const dy = down.y - up.y;
      if (u[1] <= d[0] || d[1] <= u[0] || dy >= 2 * (LABEL_HALF + DOT_CLEAR)) continue;
      shift[up.key] = above;
      // Below the higher dot, unless its words already had to go above for the controls.
      if (shift[down.key] === undefined) shift[down.key] = Math.max(0, LABEL_HALF + DOT_CLEAR - dy);
    }
  }
  return labels.map((l) => ({ ...l, shift: shift[l.key] ?? 0 }));
}

type Status = 'loading' | 'ready' | 'unsupported' | 'failed';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Set once the clip has opened, so it plays once per visit (a tab's session). */
const CLIP_KEY = 'fuego:clip';

/** Whether this visit has yet to see the clip open. Storage can be blocked: then it plays each load. */
function clipDue(): boolean {
  if (prefersReducedMotion()) return false;
  try {
    if (sessionStorage.getItem(CLIP_KEY)) return false;
    sessionStorage.setItem(CLIP_KEY, '1');
  } catch {
    // Blocked storage: play it.
  }
  return true;
}

export default function Massif({ day, locale }: MassifProps) {
  const t = getDict(locale).massif;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MassifHandle | null>(null);
  const [labels, setLabels] = useState<PlacedLabel[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [view, setView] = useState<'orbit' | 'camp'>('orbit');
  const viewRef = useRef(view);
  // The clip, once per visit. The page is server-rendered open ('idle'). When the
  // clip is due the stage holds closed ('wait') until the scene has drawn its
  // first frame, then 'play' runs the CSS animation, so the clip opens on the
  // mountain rather than on an empty box while the terrain loads.
  const [clip, setClip] = useState<'idle' | 'wait' | 'play'>('idle');
  useEffect(() => {
    // Next frame, so the effect never sets state synchronously.
    const id = requestAnimationFrame(() => { if (clipDue()) setClip('wait'); });
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (clip !== 'wait' || status === 'loading') return;
    // No scene to open on: show the stage, and its message, as it is.
    if (status !== 'ready') {
      const id = requestAnimationFrame(() => setClip('idle'));
      return () => cancelAnimationFrame(id);
    }
    // Ready: the scene draws on its next frame; open the clip on the one after.
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => setClip('play')); });
    return () => cancelAnimationFrame(id);
  }, [clip, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: MassifHandle | null = null;
    let cancelled = false;

    (async () => {
      try {
        // Checked inside the async path so the effect body never sets state
        // synchronously, which would cascade an extra render.
        if (!webglAvailable()) {
          if (!cancelled) setStatus('unsupported');
          return;
        }

        const meta = (await (await fetch(MASSIF_JSON_URL)).json()) as MassifMeta;
        const field = await loadHeightfield(MASSIF_PNG_URL, meta);
        if (cancelled) return;

        handle = createMassifScene(canvas, field, meta, {
          activity: day.explosionsMax ?? 10,
          reducedMotion: prefersReducedMotion(),
          // Labels are DOM, not WebGL, so they stay selectable and legible.
          // From camp you stand on Acatenango, so only Fuego is labelled there.
          onLabels: (ls) => setLabels(placeLabels(
            ls.map((l) => (viewRef.current === 'camp' && l.key === 'acatenango' ? { ...l, visible: false } : l)),
            canvas.clientHeight,
          )),
        });
        handleRef.current = handle;
        setStatus('ready');
      } catch (err) {
        console.error('[massif] scene failed to start', err);
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      handle?.dispose();
      handleRef.current = null;
    };
    // The scene reads activity through setActivity below; re-creating the whole
    // scene on every data change would rebuild the terrain mesh for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setDay({
      explosionsPerHour: day.explosionsMax,
      ashColumnMasl: day.ashMaxMasl,
      driftDirections: day.driftDirections,
    });
  }, [day]);
  useEffect(() => {
    viewRef.current = view;
    handleRef.current?.setView(view);
  }, [view]);

  return (
    <div className="massif" data-clip={clip === 'idle' ? undefined : clip}>
      <div className="massif-stage">
      <canvas ref={canvasRef} className="massif-canvas" aria-label={t.canvasLabel} />

      <div className="summits">
        {labels.map((l) => (
          <div
            key={l.key}
            className="summit"
            data-active={l.key === 'fuego'}
            // Near the right edge the label hangs to the left of its dot.
            data-flip={hangsLeft(l)}
            style={{
              transform: `translate(${l.x}px, ${l.y}px)${hangsLeft(l) ? ' translateX(-100%)' : ''}`,
              opacity: status === 'ready' && l.visible ? 1 : 0,
            }}
          >
            <span className="summit-dot" />
            <span className="summit-text" style={l.shift ? { transform: `translateY(${l.shift}px)` } : undefined}>
              <b>{l.name}</b>
              <i>{formatNumber(locale, l.elevation)} m · {l.key === 'fuego' ? t.erupting : t.yourCamp}</i>
            </span>
          </div>
        ))}
      </div>
      </div>

      {/* The scene's own controls sit inside it: the image tag names the view and
          the day bottom-left, and the one switch (Hoop, the watcher) bottom-right
          flips between the orbit and the view from camp. */}
      <ImageTag>{t.tag(view, formatShortDate(locale, day.date))}</ImageTag>
      <div className="massif-views" role="group" aria-label={t.viewsLabel}>
        <button type="button" className="press" aria-pressed={view === 'camp'}
          onClick={() => setView((v) => (v === 'camp' ? 'orbit' : 'camp'))}>
          <Hoop size={18} />
          {t.fromCamp}
        </button>
      </div>

      {status === 'loading' && <div className="massif-state">{t.loading}</div>}
      {status === 'unsupported' && (
        <div className="massif-state">{t.unsupported}</div>
      )}
      {status === 'failed' && (
        <div className="massif-state">{t.failed}</div>
      )}
    </div>
  );
}
