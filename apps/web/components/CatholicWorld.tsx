'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import ImmersiveAvatarScene, { type PresenceInfo, type Visitor } from './ImmersiveAvatarScene';
import { SERVERS } from '@/lib/world/presence';
import { LOOKS, type Gender } from '@/lib/world/human';
import { AMBIENCE, IMAGES, PRAYERS, TEXTURES, TRACKS, type Track } from '@/lib/world/credits';

const BAPTISMAL_NAMES = [
  '프란치스코', '마리아', '요셉', '베드로', '바오로', '안나', '데레사', '아녜스', '미카엘', '가브리엘',
  '라파엘', '루치아', '세실리아', '클라라', '모니카', '아우구스티노', '스테파노', '안드레아', '요한', '엘리사벳',
  '카타리나', '베로니카', '토마스', '야고보', '마르타', '막달레나', '로사', '비오', '도미니코', '베네딕토',
  '실비아', '젬마', '헬레나', '이냐시오', '글라라', '율리아나', '대건 안드레아', '바르바라', '마태오', '루카',
];
const randomName = () => BAPTISMAL_NAMES[Math.floor(Math.random() * BAPTISMAL_NAMES.length)];

const TOTAL = TRACKS.reduce((a, t) => a + t.duration, 0);
/**
 * Everyone hears the same moment of the same chant: the playlist is a loop anchored to
 * the clock, like a radio broadcast from the church.
 */
const livePosition = () => {
  let t = (Date.now() / 1000) % TOTAL;
  for (let i = 0; i < TRACKS.length; i += 1) {
    if (t < TRACKS[i].duration) return { index: i, offset: t };
    t -= TRACKS[i].duration;
  }
  return { index: 0, offset: 0 };
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function CatholicWorld() {
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('female');
  const [look, setLook] = useState('f-dress');
  const [ready, setReady] = useState(false);
  const [credits, setCredits] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [track, setTrack] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Starts soft and fades in; the visitor can raise it from the music panel.
  const [volume, setVolume] = useState(0.3);
  /** 'live' follows the shared broadcast; otherwise the visitor picked a chant or prayer to hear alone. */
  const [mode, setMode] = useState<'live' | 'chant' | 'prayer'>('live');
  const [picked, setPicked] = useState<Track | null>(null);
  const modeRef = useRef<{ mode: 'live' | 'chant' | 'prayer'; picked: Track | null }>({ mode: 'live', picked: null });
  modeRef.current = { mode, picked };
  const fade = useRef(0);
  const [muted, setMuted] = useState(false);
  const [placeholder, setPlaceholder] = useState('프란치스코');
  const [server, setServer] = useState(1);
  const [presence, setPresence] = useState<PresenceInfo | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setPlaceholder(randomName());
    // A shared link like /catholic?server=2 brings friends to the same server.
    const q = Number(new URLSearchParams(window.location.search).get('server'));
    if (SERVERS.includes(q as (typeof SERVERS)[number])) setServer(q);
  }, []);
  const moveServer = (n: number) => {
    setServer(n);
    setServerOpen(false);
    setVisitor(v => (v ? { ...v, server: n } : v));
    const url = new URL(window.location.href);
    url.searchParams.set('server', String(n));
    window.history.replaceState(null, '', url);
  };
  const copyInvite = async () => {
    const url = `${window.location.origin}/catholic?server=${server}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { window.prompt('이 링크를 복사해 보내 주세요', url); }
  };

  const music = useRef<HTMLAudioElement | null>(null);
  const garden = useRef<HTMLAudioElement | null>(null);
  const indoor = useRef(1);
  const volumeRef = useRef({ volume, muted });
  volumeRef.current = { volume, muted };

  const applyVolumes = useCallback(() => {
    const { volume: v, muted: m } = volumeRef.current;
    const k = indoor.current;
    const f = fade.current;
    if (music.current) music.current.volume = m ? 0 : Math.min(1, v * f * (0.22 + 0.78 * k));
    if (garden.current) garden.current.volume = m ? 0 : Math.min(1, v * f * 0.9 * (1 - k));
  }, []);
  useEffect(applyVolumes, [volume, muted, applyVolumes]);

  /** Gentle 5-second fade-in so the first sound never startles. */
  const fadeIn = useCallback(() => {
    fade.current = 0;
    const t0 = performance.now();
    const step = () => {
      fade.current = Math.min(1, (performance.now() - t0) / 5000);
      applyVolumes();
      if (fade.current < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [applyVolumes]);

  /** Play one chosen chant or prayer from the beginning (just for this visitor). */
  const playPicked = useCallback(async (t: Track) => {
    const a = music.current;
    if (!a) return;
    setPicked(t);
    a.src = t.src;
    a.currentTime = 0;
    try { await a.play(); setPlaying(true); } catch { setPlaying(false); }
  }, []);

  /** Jump to the live point of the broadcast. */
  const syncLive = useCallback(async () => {
    const a = music.current;
    if (!a) return;
    const { index, offset } = livePosition();
    setTrack(index);
    const src = TRACKS[index].src;
    const started = performance.now();
    const seek = () => {
      const at = offset + (performance.now() - started) / 1000;
      try { a.currentTime = Math.min(at, Math.max(0, (a.duration || TRACKS[index].duration) - 1)); } catch { /* not seekable yet */ }
    };
    if (!a.src.endsWith(src)) {
      a.src = src;
      a.addEventListener('loadedmetadata', seek, { once: true });
    } else seek();
    try { await a.play(); setPlaying(true); } catch { setPlaying(false); }
  }, []);

  useEffect(() => {
    const a = new Audio();
    a.preload = 'auto';
    music.current = a;
    const g = new Audio(AMBIENCE[0].src);
    g.loop = true;
    g.preload = 'auto';
    garden.current = g;
    const onEnded = () => {
      const { mode: m, picked: p } = modeRef.current;
      if (m === 'live' || !p) { void syncLive(); return; }
      // Continue with the next piece in the chosen list.
      const list = m === 'prayer' ? PRAYERS : TRACKS;
      const i = list.findIndex(x => x.id === p.id);
      void playPicked(list[(i + 1) % list.length]);
    };
    const onTime = () => setElapsed(a.currentTime);
    a.addEventListener('ended', onEnded);
    a.addEventListener('timeupdate', onTime);
    // Coming back to the tab: rejoin the live broadcast instead of drifting.
    const onVisible = () => { if (document.visibilityState === 'visible' && !a.paused && modeRef.current.mode === 'live') void syncLive(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      a.pause(); g.pause();
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('timeupdate', onTime);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [syncLive, playPicked]);

  const enter = (e?: FormEvent) => {
    e?.preventDefault();
    const n = name.trim().slice(0, 16) || randomName();
    setVisitor({ name: n, look, server });
    const url = new URL(window.location.href);
    url.searchParams.set('server', String(server));
    window.history.replaceState(null, '', url);
    fadeIn();
    void syncLive();
    garden.current?.play().catch(() => undefined);
  };
  const goLive = () => { setMode('live'); setPicked(null); void syncLive(); };
  const choose = (m: 'chant' | 'prayer', t: Track) => { setMode(m); void playPicked(t); garden.current?.play().catch(() => undefined); };

  const togglePlay = () => {
    const a = music.current;
    if (!a) return;
    if (a.paused) {
      if (mode === 'live' || !picked) void syncLive(); else void a.play().then(() => setPlaying(true)).catch(() => undefined);
      garden.current?.play().catch(() => undefined);
    }
    else { a.pause(); garden.current?.pause(); setPlaying(false); }
  };

  const onIndoor = useCallback((v: number) => { indoor.current = v; applyVolumes(); }, [applyVolumes]);
  const cur = mode !== 'live' && picked ? picked : TRACKS[track];
  const live = mode === 'live';

  return (
    <main className="catholic-world">
      <ImmersiveAvatarScene visitor={visitor} onIndoor={onIndoor} onReady={() => setReady(true)} onPresence={setPresence} />

      <div className="world-topleft">
        <button type="button" className="world-chip" onClick={() => setCredits(true)} aria-haspopup="dialog">ⓘ 출처</button>
        {visitor ? (
          <button type="button" className={`world-chip people ${presence?.status ?? ''}`} onClick={() => setServerOpen(o => !o)} aria-expanded={serverOpen}>
            👥 {server}서버 · {presence?.status === 'connecting' ? '연결 중…' : `${presence?.count ?? 1}명 함께`}
          </button>
        ) : null}
        <button type="button" className={`world-chip music ${playing ? 'on' : ''}`} onClick={() => setMusicOpen(o => !o)} aria-expanded={musicOpen}>
          <span className="live-dot" aria-hidden="true" />{playing ? (live ? 'LIVE' : '♪') : '성가'} · <span className="chip-title">{cur.title}</span>
        </button>
      </div>

      {serverOpen && visitor ? (
        <section className="server-panel" aria-label="서버">
          <header>
            <strong>함께 머무는 서버</strong>
            <button type="button" className="panel-x" onClick={() => setServerOpen(false)} aria-label="닫기">×</button>
          </header>
          <p className="server-note">같은 서버에 들어온 사람끼리 서로의 모습이 보이고, 함께 켠 초도 같이 밝혀집니다. 친구와 같은 서버 번호로 들어오세요.</p>
          <div className="server-list">
            {SERVERS.map(n => (
              <button key={n} type="button" aria-pressed={n === server} onClick={() => moveServer(n)}>
                {n}서버{n === server && presence ? <small>{presence.status === 'connecting' ? '연결 중' : `${presence.count}명`}</small> : null}
              </button>
            ))}
          </div>
          <button type="button" className="server-invite" onClick={copyInvite}>{copied ? '링크를 복사했어요' : `🔗 ${server}서버 초대 링크 복사`}</button>
          {presence?.status === 'offline' ? <p className="server-note">지금은 다른 방문자와 연결하지 못했어요. 잠시 후 서버를 다시 선택해 보세요.</p> : null}
        </section>
      ) : null}

      {musicOpen ? (
        <section className="music-panel" aria-label="성당 성가">
          <header>
            <strong>{live ? '지금 성당에 흐르는 성가' : mode === 'prayer' ? '기도문 듣기' : '성가 골라 듣기'}</strong>
            <button type="button" className="panel-x" onClick={() => setMusicOpen(false)} aria-label="닫기">×</button>
          </header>
          <div className="music-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={live} onClick={goLive}>● LIVE 함께</button>
            <button type="button" role="tab" aria-selected={mode === 'chant'} onClick={() => choose('chant', TRACKS[track])}>성가 고르기</button>
            <button type="button" role="tab" aria-selected={mode === 'prayer'} onClick={() => choose('prayer', PRAYERS[0])}>기도문 듣기</button>
          </div>
          <p className="music-now"><b>{cur.title}</b><span>{cur.composer} · {cur.performer}</span></p>
          <div className="music-progress"><i style={{ width: `${Math.min(100, (elapsed / cur.duration) * 100)}%` }} /></div>
          <div className="music-time"><span>{fmt(elapsed)}</span><span>{fmt(cur.duration)}</span></div>
          <div className="music-controls">
            <button type="button" onClick={togglePlay}>{playing ? '❚❚ 잠시 멈춤' : '▶ 듣기'}</button>
            <button type="button" onClick={() => setMuted(m => !m)} aria-pressed={muted}>{muted ? '🔇' : '🔈'}</button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="음량" />
          </div>
          <p className="music-note">{live
            ? '모든 방문자가 같은 순간의 성가를 함께 듣습니다. 정원에서는 성가가 잦아들고 바람과 새소리가 들립니다.'
            : mode === 'prayer'
              ? '한국어 기도문(AI 음성 낭독)과 라틴어로 노래하는 기도입니다. 누르면 처음부터 나만 듣고, 끝나면 다음 기도로 이어집니다.'
              : '듣고 싶은 성가를 누르면 처음부터 나만 듣습니다. LIVE를 누르면 다시 다른 방문자와 같은 성가로 돌아갑니다.'}</p>
          <ol className="music-list">
            {(mode === 'prayer' ? PRAYERS : TRACKS).map((t, i) => {
              const now = live ? i === track : picked?.id === t.id;
              return (
                <li key={t.id} className={now ? 'now' : ''}>
                  <button type="button" onClick={() => choose(mode === 'prayer' ? 'prayer' : 'chant', t)} aria-current={now ? 'true' : undefined}>
                    <span>{t.title}</span><em>{fmt(t.duration)}</em>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {credits ? (
        <div className="credits-backdrop" role="presentation" onClick={() => setCredits(false)}>
          <section className="credits-panel" role="dialog" aria-label="출처" onClick={e => e.stopPropagation()}>
            <header>
              <h2>출처와 저작권</h2>
              <button type="button" className="panel-x" onClick={() => setCredits(false)} aria-label="닫기">×</button>
            </header>
            <p className="credits-lead">이 공간의 사진·음원은 공개 라이선스 자료와 KREWX가 제공한 레퍼런스 이미지를 사이트에서 직접 제공합니다. 성모자상과 피에타는 미켈란젤로 작품 복제품의 3D 스캔이고, 사람은 실사 3D 모델입니다. 성당 건축과 나머지 성물은 코드로 만든 창작물입니다.</p>
            <h3>성가 · 음악</h3>
            <ul>{TRACKS.map(t => <li key={t.id}><b>{t.title}</b> — {t.composer} · 연주/녹음 {t.performer} · {t.license} · <a href={t.source} target="_blank" rel="noreferrer">원본</a></li>)}</ul>
            <h3>기도문 · 기도 노래</h3>
            <ul>{PRAYERS.map(t => <li key={t.id}><b>{t.title}</b> — {t.composer} · 연주/녹음 {t.performer} · {t.license} · <a href={t.source} target="_blank" rel="noreferrer">원본</a></li>)}</ul>
            <h3>환경음</h3>
            <ul>{AMBIENCE.map(t => <li key={t.id}><b>{t.title}</b> — {t.author} · {t.license} · <a href={t.source} target="_blank" rel="noreferrer">원본</a></li>)}</ul>
            <h3>스테인드글라스 · 명화</h3>
            <ul>{IMAGES.map(t => <li key={t.id}><b>{t.title}</b> — {t.author} · {t.license}{t.source.startsWith('http') ? <> · <a href={t.source} target="_blank" rel="noreferrer">원본</a></> : null}</li>)}</ul>
            <h3>3D 모델 · 재질 · 하늘</h3>
            <ul>{TEXTURES.map(t => <li key={t.title}><b>{t.title}</b> — {t.author} · {t.license} · <a href={t.source} target="_blank" rel="noreferrer">원본</a></li>)}</ul>
          </section>
        </div>
      ) : null}

      {!visitor ? (
        <div className="entry-overlay">
          <form className="entry-card" onSubmit={enter}>
            <p className="entry-kicker">ONLINE CATHEDRAL</p>
            <h1>고요한 성당</h1>
            <p className="entry-sub">성가가 흐르는 성당에 들어가 초를 봉헌하고, 묵주기도를 바치고, 마음을 내려놓으세요.</p>
            <label className="entry-name">
              <span>세례명</span>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={16} placeholder={`${placeholder} (비워두면 자동으로 정해져요)`} autoComplete="off" />
            </label>
            <div className="entry-gender" role="radiogroup" aria-label="성별">
              {(['female', 'male'] as const).map(g => (
                <button key={g} type="button" role="radio" aria-checked={gender === g}
                  onClick={() => { setGender(g); setLook(LOOKS.find(l => l.gender === g)!.id); }}>{g === 'female' ? '여성' : '남성'}</button>
              ))}
            </div>
            <fieldset className="entry-outfits looks">
              <legend>미사 옷차림</legend>
              {LOOKS.filter(l => l.gender === gender).map(o => (
                <label key={o.id} className={look === o.id ? 'on' : ''}>
                  <input type="radio" name="look" value={o.id} checked={look === o.id} onChange={() => setLook(o.id)} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/models/people/thumbs/${o.id}.jpg`} alt="" />
                  <b>{o.label}</b>
                  <small>{o.hint}</small>
                </label>
              ))}
            </fieldset>
            <fieldset className="entry-servers">
              <legend>서버 <small>같은 서버에 들어온 사람들과 함께 머물러요</small></legend>
              {SERVERS.map(n => (
                <label key={n} className={server === n ? 'on' : ''}>
                  <input type="radio" name="server" value={n} checked={server === n} onChange={() => setServer(n)} />
                  {n}서버
                </label>
              ))}
            </fieldset>
            <button type="submit" className="entry-go" disabled={!ready}>{ready ? '입장하기' : '성당 문을 여는 중…'}</button>
            <p className="entry-foot">입장하면 성가가 함께 재생됩니다 · 이름은 이 기기에서만 쓰입니다</p>
          </form>
        </div>
      ) : null}
    </main>
  );
}
