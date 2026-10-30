'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MYSTERIES, mysteryForDay, rosaryLayout, rosarySteps, type MysterySet, type RosaryStep } from '@/lib/world/rosary';

type Props = {
  onStep: (step: RosaryStep) => void;
  onClose: () => void;
};

/**
 * Rosary panel: scroll the mouse wheel (or swipe) over the beads to pass them one at a time,
 * or jump a whole decade with the buttons. The avatar's thumb moves to the next bead in step.
 */
/** Recorded prayers (AI voice) for each kind of bead. */
const clipsFor = (prayer: string): string[] => {
  if (prayer.startsWith('성호경')) return ['ko-sign-of-cross', 'ko-apostles-creed'];
  if (prayer.startsWith('주님의 기도')) return ['ko-our-father'];
  if (prayer.startsWith('성모송')) return ['ko-hail-mary'];
  if (prayer.startsWith('영광송 · 구원의 기도')) return ['ko-glory-be', 'ko-fatima'];
  if (prayer.startsWith('영광송')) return ['ko-glory-be'];
  if (prayer.startsWith('성모 찬송')) return ['ko-salve-regina'];
  return [];
};

export default function RosaryPanel({ onStep, onClose }: Props) {
  const [set, setSet] = useState<MysterySet>(() => mysteryForDay(new Date().getDay()));
  const [step, setStep] = useState(0);
  const steps = useMemo(() => rosarySteps(set), [set]);
  const beads = useMemo(() => rosaryLayout(), []);
  const ref = useRef<HTMLDivElement>(null);
  const wheelAcc = useRef(0);
  const touchY = useRef<number | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const emit = (n: number) => onStepRef.current(stepsRef.current[n]);

  const go = (next: number) => {
    const n = Math.max(0, Math.min(steps.length - 1, next));
    setStep(prev => {
      if (prev !== n) emit(n);
      return n;
    });
  };
  const goRef = useRef(go);
  goRef.current = go;

  // Prayer voice: reads each prayer aloud (AI voice) and, when it finishes, moves to the next bead.
  const [voice, setVoice] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!voice) return;
    const clips = clipsFor(steps[step].prayer);
    if (!clips.length) return;
    let cancelled = false;
    let timer = 0;
    const audio = new Audio();
    audio.volume = 0.9;
    let i = 0;
    const next = () => {
      if (cancelled) return;
      if (i >= clips.length) {
        setSpeaking(false);
        if (step < steps.length - 1) timer = window.setTimeout(() => goRef.current(step + 1), 700);
        return;
      }
      audio.src = `/audio/${clips[i++]}.mp3`;
      audio.play().then(() => setSpeaking(true)).catch(() => setSpeaking(false));
    };
    audio.addEventListener('ended', next);
    next();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      audio.pause();
      audio.removeEventListener('ended', next);
      setSpeaking(false);
    };
  }, [voice, step, steps]);

  // Wheel needs a non-passive listener to keep the page (and the camera zoom) still.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      wheelAcc.current += e.deltaY;
      const notch = 60;
      while (Math.abs(wheelAcc.current) >= notch) {
        const dir = Math.sign(wheelAcc.current);
        wheelAcc.current -= dir * notch;
        setStep(prev => {
          const n = Math.max(0, Math.min(stepsRef.current.length - 1, prev + dir));
          if (n !== prev) emit(n);
          return n;
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cur = steps[step];
  const decadeStart = (d: number) => steps.findIndex(s => s.decade === d && s.bead === `L${d}`);
  const jumpDecade = (dir: 1 | -1) => {
    if (dir > 0) {
      const nextD = Math.min(5, cur.decade + 1);
      const i = cur.decade >= 5 ? steps.length - 1 : decadeStart(nextD);
      go(i);
    } else {
      const here = cur.decade === 0 ? 0 : decadeStart(cur.decade);
      const target = step > here ? here : cur.decade <= 1 ? 0 : decadeStart(cur.decade - 1);
      go(target);
    }
  };

  // Beads already prayed glow softly; the current one shines.
  const doneBeads = new Set(steps.slice(0, step).map(s => s.bead));
  const hailCount = steps.slice(0, step + 1).filter(s => s.prayer.startsWith('성모송')).length;

  return (
    <aside className="rosary-panel" aria-label="묵주기도">
      <header>
        <div>
          <strong>묵주기도</strong>
          <span>{set.name} · {set.days}요일</span>
        </div>
        <button type="button" className="rosary-close" onClick={onClose} aria-label="묵주기도 닫기">×</button>
      </header>
      <div className="rosary-mysteries" role="radiogroup" aria-label="신비 선택">
        {MYSTERIES.map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={m.id === set.id}
            onClick={() => { setSet(m); setStep(0); onStepRef.current(rosarySteps(m)[0]); }}>{m.name.replace('의 신비', '')}</button>
        ))}
      </div>
      <div
        ref={ref}
        className="rosary-beads"
        tabIndex={0}
        role="slider"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step + 1}
        aria-valuetext={`${cur.prayer}${cur.detail ? ` · ${cur.detail}` : ''}`}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(step + 1); }
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(step - 1); }
          if (e.key === 'PageDown') { e.preventDefault(); jumpDecade(1); }
          if (e.key === 'PageUp') { e.preventDefault(); jumpDecade(-1); }
        }}
        onTouchStart={e => { touchY.current = e.touches[0].clientY; }}
        onTouchMove={e => {
          if (touchY.current === null) return;
          const dy = touchY.current - e.touches[0].clientY;
          if (Math.abs(dy) > 26) { go(step + Math.sign(dy)); touchY.current = e.touches[0].clientY; }
        }}
        onTouchEnd={() => { touchY.current = null; }}
      >
        <svg viewBox="0 0 320 380" aria-hidden="true">
          <defs>
            <radialGradient id="rb-cur" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fff8df" /><stop offset="0.5" stopColor="#f2cf7c" /><stop offset="1" stopColor="#b78a35" /></radialGradient>
            <radialGradient id="rb-done" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#fff3dc" /><stop offset="1" stopColor="#d9b98a" /></radialGradient>
            <radialGradient id="rb-todo" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#f3ece2" /><stop offset="1" stopColor="#9d9182" /></radialGradient>
            <filter id="rb-glow"><feGaussianBlur stdDeviation="3.2" /></filter>
          </defs>
          <circle cx="160" cy="150" r="112" fill="none" stroke="#c9b48a55" strokeWidth="1.2" />
          <line x1="160" y1="262" x2="160" y2="345" stroke="#c9b48a55" strokeWidth="1.2" />
          {beads.map(b => {
            const isCur = b.id === cur.bead;
            const done = doneBeads.has(b.id) && !isCur;
            if (b.id === 'cross') {
              return (
                <g key={b.id} transform={`translate(${b.x} ${b.y})`} onClick={() => go(0)} style={{ cursor: 'pointer' }}>
                  {isCur ? <rect x="-9" y="-16" width="18" height="34" fill="#ffd98a" opacity="0.6" filter="url(#rb-glow)" /> : null}
                  <rect x="-2.6" y="-14" width="5.2" height="30" rx="1" fill={isCur ? '#f2cf7c' : '#cdb27a'} />
                  <rect x="-9" y="-6" width="18" height="5" rx="1" fill={isCur ? '#f2cf7c' : '#cdb27a'} />
                </g>
              );
            }
            if (b.id === 'medal') {
              return <g key={b.id}>
                {isCur ? <circle cx={b.x} cy={b.y} r="13" fill="#ffd98a" opacity="0.7" filter="url(#rb-glow)" /> : null}
                <ellipse cx={b.x} cy={b.y} rx="8" ry="10" fill={isCur ? 'url(#rb-cur)' : '#cdb27a'} stroke="#8a6a2e" strokeWidth="0.8" />
              </g>;
            }
            const r = b.large ? 7.2 : 5.1;
            const idx = steps.findIndex(s => s.bead === b.id);
            return (
              <g key={b.id} onClick={() => idx >= 0 && go(idx)} style={{ cursor: 'pointer' }}>
                {isCur ? <circle cx={b.x} cy={b.y} r={r + 6} fill="#ffd98a" opacity="0.75" filter="url(#rb-glow)" /> : null}
                <circle cx={b.x} cy={b.y} r={isCur ? r + 1.6 : r} fill={isCur ? 'url(#rb-cur)' : done ? 'url(#rb-done)' : 'url(#rb-todo)'} stroke={b.large ? '#8a6a2e' : '#7d6f60'} strokeWidth="0.6" />
              </g>
            );
          })}
          <text x="160" y="140" textAnchor="middle" className="rosary-center-big">{cur.decade > 0 ? `${cur.decade}단` : '시작'}</text>
          <text x="160" y="164" textAnchor="middle" className="rosary-center-small">성모송 {hailCount}/53</text>
        </svg>
      </div>
      <div className="rosary-now" aria-live="polite">
        <strong>{cur.prayer}</strong>
        {cur.detail ? <span>{cur.detail}</span> : null}
      </div>
      <button type="button" className={`rosary-voice${voice ? ' on' : ''}`} aria-pressed={voice} onClick={() => setVoice(v => !v)}>
        {voice ? (speaking ? '🔊 기도문을 함께 읽는 중 · 끄기' : '🔊 기도 소리 켜짐 · 끄기') : '🔈 기도문 소리로 함께 바치기'}
      </button>
      <div className="rosary-controls">
        <button type="button" onClick={() => jumpDecade(-1)}>⏮ 이전 단</button>
        <button type="button" onClick={() => go(step - 1)} aria-label="이전 알">▲</button>
        <button type="button" onClick={() => go(step + 1)} aria-label="다음 알">▼</button>
        <button type="button" onClick={() => jumpDecade(1)}>다음 단 ⏭</button>
      </div>
      <p className="rosary-hint">{voice ? '기도문 소리가 끝나면 다음 알로 저절로 넘어갑니다.' : '묵주 위에서 마우스 휠을 굴리면 한 알씩, 버튼으로 한 단씩 넘어갑니다.'}</p>
    </aside>
  );
}
