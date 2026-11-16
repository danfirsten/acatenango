'use client';

import { useEffect, useRef, useState } from 'react';

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

export default function Massif({ day }: MassifProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MassifHandle | null>(null);
  const [labels, setLabels] = useState<LabelPosition[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [view, setView] = useState<'orbit' | 'camp'>('orbit');

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
          onLabels: setLabels,
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
  useEffect(() => { handleRef.current?.setView(view); }, [view]);

  return (
    <div className="massif">
      <canvas ref={canvasRef} className="massif-canvas" aria-label="Three-dimensional view of the Acatenango and Fuego massif, built from elevation data" />

      {labels.map((l) => (
        <div
          key={l.key}
          className="summit"
          data-active={l.key === 'fuego'}
          style={{
            transform: `translate(${l.x}px, ${l.y}px)`,
            opacity: status === 'ready' && l.visible ? 1 : 0,
          }}
        >
          <span className="summit-dot" />
          <span className="summit-text">
            <b>{l.name}</b>
            <i>{l.elevation.toLocaleString()} m{l.key === 'fuego' ? ' · erupting' : ' · your camp'}</i>
          </span>
        </div>
      ))}

      <div className="massif-views" role="group" aria-label="Camera view">
        <button type="button" onClick={() => setView('orbit')} aria-pressed={view === 'orbit'}>Orbit</button>
        <button type="button" onClick={() => setView('camp')} aria-pressed={view === 'camp'}>From camp</button>
      </div>

      {status === 'loading' && <div className="massif-state">Loading elevation data…</div>}
      {status === 'unsupported' && (
        <div className="massif-state">
          This view needs WebGL. The readings below work without it.
        </div>
      )}
      {status === 'failed' && (
        <div className="massif-state">Terrain unavailable. The readings below are unaffected.</div>
      )}
    </div>
  );
}
