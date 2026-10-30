'use client';

import { useEffect, useRef, useState } from 'react';
import ImmersiveAvatarScene from './ImmersiveAvatarScene';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useReligionRoom } from '@/lib/use-religion-room';

type Intention = { id: string; text: string; createdAt: string };
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const parishId = process.env.NEXT_PUBLIC_PARISH_ID;
const audioUrl = process.env.NEXT_PUBLIC_GREGORIAN_AUDIO_URL || 'https://upload.wikimedia.org/wikipedia/commons/9/96/Veni.sancte.spiritus.ogg';
const gardenAudioUrl = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Gentle_breeze_and_birds_singing.ogg';
const chapelPhotoUrl = 'https://images.unsplash.com/photo-1759432916468-d44411b5a661?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=85&w=2400';

export default function ChapelExperience() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [intention, setIntention] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [candleCount, setCandleCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const space = 'chapel' as const;
  const [immersive, setImmersive] = useState(false);
  const [baptismalName, setBaptismalName] = useState('');
  const [entryNotice, setEntryNotice] = useState('');
  const room = useReligionRoom(space, baptismalName, immersive);
  const [quietSeconds, setQuietSeconds] = useState(180);
  const [quietRunning, setQuietRunning] = useState(false);

  useEffect(() => {
    if (!quietRunning) return;
    const timer = window.setInterval(() => {
      setQuietSeconds(seconds => {
        return Math.max(0, seconds - 1);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quietRunning]);

  useEffect(() => {
    if (quietSeconds === 0) setQuietRunning(false);
  }, [quietSeconds]);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;
    setSupabase(createClient(supabaseUrl, supabaseKey));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.signInAnonymously();
    })();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !parishId) return;
    const loadIntentions = async () => {
      const { data, error } = await supabase.from('prayer_intentions')
        .select('id, intention, created_at')
        .eq('parish_id', parishId).eq('is_public', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(20);
      if (!error) setIntentions((data ?? []).map(row => ({ id: row.id, text: row.intention, createdAt: row.created_at })));
      const { count } = await supabase.from('prayer_intentions').select('id', { count: 'exact', head: true }).eq('parish_id', parishId).eq('is_public', true).gt('expires_at', new Date().toISOString());
      if (count !== null) setCandleCount(count);
    };
    void loadIntentions();
    const channel = supabase.channel('public-prayer-intentions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prayer_intentions', filter: `parish_id=eq.${parishId}` }, payload => {
        const row = payload.new as { id: string; intention: string; created_at: string; is_public: boolean; expires_at: string };
        if (row.is_public && row.expires_at > new Date().toISOString()) {
          setIntentions(items => [{ id: row.id, text: row.intention, createdAt: row.created_at }, ...items.filter(item => item.id !== row.id)].slice(0, 20));
          setCandleCount(count => count + 1);
        }
      }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [supabase]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }, [space]);

  const addIntention = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = intention.trim();
    if (text.length < 3) { setNotice('기도 지향을 세 글자 이상 입력해 주세요.'); return; }
    setLoading(true); setNotice('');
    let saved = false;
    if (supabase && parishId) {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const authResult = await supabase.auth.signInAnonymously();
        session = authResult.data.session;
        if (authResult.error || !session) { setNotice('익명 로그인에 실패했어요. Supabase Anonymous Sign-Ins 설정을 확인해 주세요.'); setLoading(false); return; }
      }
      const { error } = await supabase.from('prayer_intentions').insert({ parish_id: parishId, author_id: session.user.id, intention: text, is_public: isPublic, candle_lit: true });
      if (error) setNotice('봉헌을 저장하지 못했어요. 본당 ID와 Supabase 정책 설정을 확인해 주세요.');
      else if (isPublic) {
        saved = true;
        const { data } = await supabase.from('prayer_intentions').select('id, intention, created_at')
          .eq('parish_id', parishId).eq('is_public', true).order('created_at', { ascending: false }).limit(20);
        setIntentions((data ?? []).map(row => ({ id: row.id, text: row.intention, createdAt: row.created_at })));
        const { count } = await supabase.from('prayer_intentions').select('id', { count: 'exact', head: true }).eq('parish_id', parishId).eq('is_public', true).gt('expires_at', new Date().toISOString());
        if (count !== null) setCandleCount(count);
      } else { saved = true; setNotice('기도 지향을 비공개로 봉헌했어요.'); }
    } else {
      if (isPublic) { setIntentions(items => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...items]); setCandleCount(count => count + 1); saved = true; }
      else { setNotice('기도 지향을 이 브라우저에서 비공개로 봉헌했어요. (데모 모드)'); saved = true; }
    }
    if (saved) setIntention('');
    setLoading(false);
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) { setNotice('오디오 플레이어를 준비하지 못했어요.'); return; }
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { try { await audio.play(); setIsPlaying(true); } catch { setNotice('음원을 재생할 수 없어요. 음원 주소를 확인해 주세요.'); } }
  };

  const enterImmersive = () => {
    if (!baptismalName.trim()) {
      setEntryNotice('입장할 세례명을 입력해 주세요.');
      return;
    }
    setEntryNotice('');
    setImmersive(true);
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  };

  const leaveImmersive = () => {
    setImmersive(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  if (immersive) {
    return (
      <main className="immersive-room immersive-chapel">
        <header className="immersive-toolbar">
          <div className="immersive-player" aria-label={`${baptismalName} avatar`}><span className="immersive-avatar-mark">{baptismalName.trim().slice(0, 1)}</span></div>
          <button type="button" className="immersive-exit" onClick={leaveImmersive} aria-label="체험 나가기">×</button>
        </header>
        <section className="immersive-world" aria-label="성당과 정원이 연결된 가상 공간"><ImmersiveAvatarScene displayName={baptismalName.trim()} /></section>
      </main>
    );
  }

  return (
    <div className="chapel-shell">
      <header className="topbar"><a className="brand" href="#"><span className="brand-mark">✝</span><span>RELIGION<small>함께 머무는 기도의 공간</small></span></a><div className="top-meta"><span className="live-dot" /> 온라인 기도 공간 <span className="meta-divider" /> 가톨릭 · 본당 공동체</div></header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">A QUIET PLACE TO PRAY</p><h1>잠시 머물며,<br/><em>함께 기도합니다.</em></h1><p className="hero-description">마음에 담아둔 지향을 촛불에 맡기고,<br/>우리 공동체의 기도를 하나로 모아보세요.</p><a className="hero-link" href="#offering">기도 봉헌하기 <span>↓</span></a></div>
        <div className="lobby-visual" style={{ backgroundImage: `linear-gradient(180deg,rgba(13,17,15,.16),rgba(13,17,15,.18) 42%,rgba(13,17,15,.82)), url("${chapelPhotoUrl}")` }}>
          <div className="lobby-topline"><span>CHAPEL · COURTYARD GARDEN</span><span className="lobby-online"><i /> {room.status === 'connected' ? `${room.occupancy}명 머무는 중` : '나만의 공간'}</span></div>
          <div className="lobby-bottom">
            <div className="lobby-entry-profile">
              <div className="lobby-avatar-card">
                <span className="lobby-avatar-mark">Y</span>
                <span><strong>{baptismalName.trim() || '나의 아바타'}</strong><small>입장할 세례명</small></span>
              </div>
              <label className="lobby-baptismal-field">
                <span>세례명</span>
                <input
                  value={baptismalName}
                  onChange={event => { setBaptismalName(event.target.value.slice(0, 18)); setEntryNotice(''); }}
                  onKeyDown={event => { if (event.key === 'Enter') enterImmersive(); }}
                  maxLength={18}
                  placeholder="예: 요셉"
                  autoComplete="off"
                  aria-label="입장할 세례명"
                />
              </label>
              {entryNotice ? <p className="lobby-entry-notice" role="alert">{entryNotice}</p> : null}
            </div>
            <button type="button" className="lobby-enter" onClick={enterImmersive} disabled={!baptismalName.trim()}>입장하기 <span>→</span></button>
          </div>
          <div className="lobby-photo-credit">성당에서 시작해 문을 열고 정원으로 이어지는 공간</div>
        </div>
      </section>
      <div className="content-grid">
        <section className="panel offering-panel" id="offering">
          <div className="section-kicker">01 / CANDLE OFFERING</div><h2>기도 지향 봉헌</h2><p className="section-intro">마음속 소망과 기도를 글로 남기고 작은 촛불을 밝혀보세요.</p>
          <form onSubmit={addIntention} className="intention-form"><label htmlFor="intention">나의 기도 지향</label><textarea id="intention" value={intention} onChange={e => setIntention(e.target.value)} maxLength={500} placeholder="주님, 오늘 제가 바치는 이 기도를 들어주소서..." /><div className="form-bottom"><span>{intention.length}/500</span><label className="privacy-toggle"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /><span className="toggle-ui" /> 공동체에 공개하기</label></div><button className="primary-button" type="submit" disabled={loading}>{loading ? '봉헌 중...' : '🕯　촛불 밝히기'}</button></form>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="privacy-note">🔒 공개를 선택하지 않으면 기도 지향은 다른 사람에게 표시되지 않습니다.</div>
          <div className="candle-summary"><div className="candle-icon">🕯</div><div><strong>{candleCount.toLocaleString()}개의 촛불</strong><span>현재 밝혀진 공개 촛불</span></div></div>
          {intentions.length > 0 && <div className="intention-list"><h3>함께 봉헌된 기도</h3>{intentions.slice(0,4).map(item => <article key={item.id} className="intention-item"><span>🕯</span><p>{item.text}</p></article>)}</div>}
        </section>
        <section className="panel prayer-guide-panel">
          <div className="section-kicker">02 / A MOMENT OF PRAYER</div><h2>마음을 모으는 짧은 기도</h2><p className="section-intro">잠시 멈추고 마음을 가다듬으며, 오늘의 기도를 시작해 보세요.</p>
          <div className="prayer-guide-visual"><span>✝</span><i></i></div>
          <blockquote className="prayer-quote">“주님, 제 마음 안에 머무르시고<br/>오늘의 걸음을 평화로 이끌어 주소서.”</blockquote>
          <div className="quiet-prayer" aria-live="polite">
            <div className="quiet-prayer-time">{String(Math.floor(quietSeconds / 60)).padStart(2, '0')}:{String(quietSeconds % 60).padStart(2, '0')}</div>
            <p>{quietSeconds === 0 ? '고요한 기도 시간이 끝났습니다.' : quietRunning ? '잠시 모든 것을 내려놓고 머물러 보세요.' : '원하는 만큼 조용히 머무는 시간을 가져보세요.'}</p>
            <div className="quiet-prayer-actions">
              <button type="button" onClick={() => setQuietRunning(value => !value)}>{quietRunning ? '잠시 멈춤' : quietSeconds === 0 ? '다시 시작' : '3분 기도 시작'}</button>
              <button type="button" className="quiet-reset" onClick={() => { setQuietRunning(false); setQuietSeconds(180); }}>초기화</button>
            </div>
          </div>
          <p className="micro-copy">조용한 공간에서 잠시 침묵하며 기도의 시간을 가져보세요.</p>
        </section>
        <section className="panel chant-panel">
          <div className="section-kicker">03 / {space === 'chapel' ? 'GREGORIAN CHANT' : 'GARDEN AMBIENCE'}</div><div className="chant-layout"><div><h2>{space === 'chapel' ? '고요히 흐르는 성가' : '정원에 머무는 자연의 소리'}</h2><p className="section-intro">{space === 'chapel' ? '그레고리오 성가와 함께 기도의 시간을 가져보세요.' : '산들바람과 새소리가 흐르는 정원에서 잠시 쉬어가세요.'}</p><div className="track-title"><span className="sound-wave">♫</span><div><strong>{space === 'chapel' ? 'Veni Sancte Spiritus' : 'Gentle Breeze and Birds'}</strong><small>{space === 'chapel' ? '그레고리오 성가 · 성령 송가' : '정원 자연음 · 산들바람과 새소리'}</small></div></div></div><div className="audio-controls"><button className="play-button" onClick={toggleAudio} aria-label={isPlaying?'일시정지':'재생'}>{isPlaying?'Ⅱ':'▶'}</button><label className="volume-control">VOL <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label></div></div>
          <audio ref={audioRef} src={space === 'chapel' ? audioUrl : gardenAudioUrl} loop preload="none" onEnded={()=>setIsPlaying(false)} onPause={()=>setIsPlaying(false)} onPlay={()=>setIsPlaying(true)} />
          <div className="chant-footnote">{space === 'chapel' ? <>음원: Membeth · Wikimedia Commons · Public Domain. <a href="https://commons.wikimedia.org/wiki/File:Veni.sancte.spiritus.ogg" target="_blank" rel="noreferrer">원본 및 이용 정보</a></> : <>음원: ezwa · Wikimedia Commons · Public Domain. <a href="https://commons.wikimedia.org/wiki/File:Gentle_breeze_and_birds_singing.ogg" target="_blank" rel="noreferrer">원본 및 이용 정보</a></>}</div>
        </section>
      </div>
      <footer className="footer"><span>RELIGION © 2026</span><span>가상 기도 공간은 실제 미사와 성사를 대체하지 않습니다.</span></footer>
    </div>
  );
}
