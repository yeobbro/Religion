'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import ImmersiveAvatarScene, { type PresenceInfo, type Visitor } from './ImmersiveAvatarScene';
import { SERVERS } from '@/lib/world/presence';
import { VISITOR_OUTFITS, type Outfit } from '@/lib/world/avatar';
import { AMBIENCE, IMAGES, TEXTURES, TRACKS } from '@/lib/world/credits';

const BAPTISMAL_NAMES = [
  '프란치스코', '마리아', '요셉', '베드로', '바오로', '안나', '데레사', '아녜스', '미카엘', '가브리엘',
  '라파엘', '루치아', '세실리아', '클라라', '모니카', '아우구스티노', '스테파노', '안드레아', '요한', '엘리사벳',
  '카타리나', '베로니카', '토마스', '야고보', '마르타', '막달레나', '로사', '비오', '도미니코', '베네딕토',
  '실비아', '젬마', '헬레나', '이냐시오', '글라라', '율리아나', '대건 안드레아', '바르바라', '마태오', '루카',
];
const randomName = () => BAPTISMAL_NAMES[Math.floor(Math.random() * BAPTISMAL_NAMES.length)];

const OUTFIT_SWATCH: Record<Outfit, [string, string]> = {
  casual: ['#ecdcc4', '#47546e'],
  dress: ['#fbf8f2', '#eadfc6'],
  nun: ['#1d1e26', '#fbf8f3'],
  monk: ['#6b4a31', '#f2eee6'],
  priest: ['#f7f4ec', '#2f6a46'],
  server: ['#1b1b20', '#f7f4ec'],
  choir: ['#6e1f2a', '#fbf8f3'],
};

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
  const [outfit, setOutfit] = useState<Outfit>('casual');
  const [ready, setReady] = useState(false);
  const [credits, setCredits] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [track, setTrack] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.55);
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
    if (music.current) music.current.volume = m ? 0 : Math.min(1, v * (0.22 + 0.78 * k));
    if (garden.current) garden.current.volume = m ? 0 : Math.min(1, v * 0.9 * (1 - k));
  }, []);
  useEffect(applyVolumes, [volume, muted, applyVolumes]);

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
    const onEnded = () => { void syncLive(); };
    const onTime = () => setElapsed(a.currentTime);
    a.addEventListener('ended', onEnded);
    a.addEventListener('timeupdate', onTime);
    // Coming back to the tab: rejoin the live broadcast instead of drifting.
    const onVisible = () => { if (document.visibilityState === 'visible' && !a.paused) void syncLive(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      a.pause(); g.pause();
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('timeupdate', onTime);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [syncLive]);

  const enter = (e?: FormEvent) => {
    e?.preventDefault();
    const n = name.trim().slice(0, 16) || randomName();
    setVisitor({ name: n, outfit, server });
    const url = new URL(window.location.href);
    url.searchParams.set('server', String(server));
    window.history.replaceState(null, '', url);
    applyVolumes();
    void syncLive();
    garden.current?.play().catch(() => undefined);
  };

  const togglePlay = () => {
    const a = music.current;
    if (!a) return;
    if (a.paused) { void syncLive(); garden.current?.play().catch(() => undefined); }
    else { a.pause(); garden.current?.pause(); setPlaying(false); }
  };

  const onIndoor = useCallback((v: number) => { indoor.current = v; applyVolumes(); }, [applyVolumes]);
  const cur = TRACKS[track];

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
          <span className="live-dot" aria-hidden="true" />{playing ? 'LIVE' : '성가'} · <span className="chip-title">{cur.title}</span>
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
            <strong>지금 성당에 흐르는 성가</strong>
            <button type="button" className="panel-x" onClick={() => setMusicOpen(false)} aria-label="닫기">×</button>
          </header>
          <p className="music-now"><b>{cur.title}</b><span>{cur.composer} · {cur.performer}</span></p>
          <div className="music-progress"><i style={{ width: `${Math.min(100, (elapsed / cur.duration) * 100)}%` }} /></div>
          <div className="music-time"><span>{fmt(elapsed)}</span><span>{fmt(cur.duration)}</span></div>
          <div className="music-controls">
            <button type="button" onClick={togglePlay}>{playing ? '❚❚ 잠시 멈춤' : '▶ 함께 듣기'}</button>
            <button type="button" onClick={() => setMuted(m => !m)} aria-pressed={muted}>{muted ? '🔇' : '🔈'}</button>
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))} aria-label="음량" />
          </div>
          <p className="music-note">모든 방문자가 같은 순간의 성가를 듣습니다. 성당 밖 정원에서는 성가가 잦아들고 바람과 새소리가 들립니다.</p>
          <ol className="music-list">
            {TRACKS.map((t, i) => <li key={t.id} className={i === track ? 'now' : ''}><span>{t.title}</span><em>{fmt(t.duration)}</em></li>)}
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
            <p className="credits-lead">이 공간의 사진·음원은 공개 라이선스 자료와 KREWX가 제공한 레퍼런스 이미지를 사이트에서 직접 제공합니다. 성당 건축, 조각상, 인물은 코드로 만든 창작물입니다.</p>
            <h3>성가 · 음악</h3>
            <ul>{TRACKS.map(t => <li key={t.id}><b>{t.title}</b> — {t.composer} · 연주/녹음 {t.performer} · {t.license} · <a href={t.source} target="_blank" rel="noreferrer">원본</a></li>)}</ul>
            <h3>환경음</h3>
            <ul>{AMBIENCE.map(t => <li key={t.id}><b>{t.title}</b> — {t.author} · {t.license} · <a href={t.source} target="_blank" rel="noreferrer">원본</a></li>)}</ul>
            <h3>스테인드글라스 · 명화</h3>
            <ul>{IMAGES.map(t => <li key={t.id}><b>{t.title}</b> — {t.author} · {t.license}{t.source.startsWith('http') ? <> · <a href={t.source} target="_blank" rel="noreferrer">원본</a></> : null}</li>)}</ul>
            <h3>재질 · 하늘</h3>
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
            <fieldset className="entry-outfits">
              <legend>옷차림</legend>
              {VISITOR_OUTFITS.map(o => (
                <label key={o.id} className={outfit === o.id ? 'on' : ''}>
                  <input type="radio" name="outfit" value={o.id} checked={outfit === o.id} onChange={() => setOutfit(o.id)} />
                  <i style={{ background: `linear-gradient(135deg, ${OUTFIT_SWATCH[o.id][0]} 55%, ${OUTFIT_SWATCH[o.id][1]} 55%)` }} aria-hidden="true" />
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
