'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Intention = { id: string; text: string; createdAt: string };
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const parishId = process.env.NEXT_PUBLIC_PARISH_ID;
const audioUrl = process.env.NEXT_PUBLIC_GREGORIAN_AUDIO_URL;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function ChapelExperience() {
  const [intention, setIntention] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [decades, setDecades] = useState(0);
  const [todayDecades, setTodayDecades] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const audioRef = useRef<HTMLAudioElement>(null);
  const isConnected = Boolean(supabase && parishId);

  const loadCommunityCount = useCallback(async () => {
    if (!supabase || !parishId) return;
    const { data, error } = await supabase.from('rosary_contributions').select('decades, created_at').eq('parish_id', parishId);
    if (error) { setNotice('공동 묵주 기록을 불러오지 못했어요. Supabase 설정을 확인해 주세요.'); return; }
    const rows = data ?? [];
    setDecades(rows.reduce((sum, row) => sum + Number(row.decades), 0));
    const today = new Date().toLocaleDateString('en-CA');
    setTodayDecades(rows.filter(row => new Date(row.created_at).toLocaleDateString('en-CA') === today).reduce((sum, row) => sum + Number(row.decades), 0));
  }, []);

  useEffect(() => {
    if (!supabase || !parishId) return;
    void loadCommunityCount();
    const channel = supabase.channel('parish-rosary-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rosary_contributions', filter: `parish_id=eq.${parishId}` }, () => void loadCommunityCount())
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [loadCommunityCount]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  const progress = Math.min(100, Math.round((decades / 1000) * 100));
  const candleCount = intentions.length;

  const addIntention = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = intention.trim();
    if (text.length < 3) { setNotice('기도 지향을 세 글자 이상 입력해 주세요.'); return; }
    setLoading(true); setNotice('');
    if (supabase && parishId) {
      const { error } = await supabase.from('prayer_intentions').insert({ parish_id: parishId, intention: text, is_public: isPublic, candle_lit: true });
      if (error) setNotice('봉헌을 저장하지 못했어요. 로그인 및 Supabase 정책 설정을 확인해 주세요.');
      else if (isPublic) setIntentions(items => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...items]);
      else setNotice('기도 지향을 비공개로 봉헌했어요.');
    } else {
      if (isPublic) setIntentions(items => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...items]);
      else setNotice('기도 지향을 이 브라우저에서 비공개로 봉헌했어요. (데모 모드)');
    }
    setIntention(''); setLoading(false);
  };

  const contributeRosary = async () => {
    if (supabase && parishId) {
      const { error } = await supabase.from('rosary_contributions').insert({ parish_id: parishId, decades: 5 });
      if (error) { setNotice('묵주 기록에 실패했어요. 로그인 상태와 본당 ID를 확인해 주세요.'); return; }
      await loadCommunityCount();
    } else {
      setDecades(value => value + 5);
      setTodayDecades(value => value + 5);
    }
    setNotice('묵주 5단을 본당 공동 기도에 보탰어요.');
  };

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) { setNotice('성가 음원 URL이 아직 연결되지 않았어요. 사용 권한이 확인된 녹음을 연결해 주세요.'); return; }
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { try { await audio.play(); setIsPlaying(true); } catch { setNotice('음원을 재생할 수 없어요. 음원 주소를 확인해 주세요.'); } }
  };

  return (
    <div className="chapel-shell">
      <header className="topbar"><a className="brand" href="#"><span className="brand-mark">✝</span><span>RELIGION<small>함께 머무는 기도의 공간</small></span></a><div className="top-meta"><span className="live-dot" /> 온라인 기도 공간 <span className="meta-divider" /> 가톨릭 · 본당 공동체</div></header>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">A QUIET PLACE TO PRAY</p><h1>잠시 머물며,<br/><em>함께 기도합니다.</em></h1><p className="hero-description">마음에 담아둔 지향을 촛불에 맡기고,<br/>우리 공동체의 기도를 하나로 모아보세요.</p><a className="hero-link" href="#offering">기도 봉헌하기 <span>↓</span></a></div>
        <div className="chapel-scene" aria-label="촛불이 밝혀진 성당 내부 분위기"><div className="window-glow" /><div className="altar-cross">✝</div><div className="altar-line" /><div className="candle-row"><i/><i/><i/><i/><i/></div><div className="scene-caption">IN HIS PEACE · IN OUR PRAYER</div></div>
      </section>
      <div className="content-grid">
        <section className="panel offering-panel" id="offering">
          <div className="section-kicker">01 / CANDLE OFFERING</div><h2>기도 지향 봉헌</h2><p className="section-intro">마음속 소망과 기도를 글로 남기고 작은 촛불을 밝혀보세요.</p>
          <form onSubmit={addIntention} className="intention-form"><label htmlFor="intention">나의 기도 지향</label><textarea id="intention" value={intention} onChange={e => setIntention(e.target.value)} maxLength={500} placeholder="주님, 오늘 제가 바치는 이 기도를 들어주소서..." /><div className="form-bottom"><span>{intention.length}/500</span><label className="privacy-toggle"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /><span className="toggle-ui" /> 공동체에 공개하기</label></div><button className="primary-button" type="submit" disabled={loading}>{loading ? '봉헌 중...' : '🕯　촛불 밝히기'}</button></form>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="privacy-note">🔒 공개를 선택하지 않으면 기도 지향은 다른 사람에게 표시되지 않습니다.</div>
          <div className="candle-summary"><div className="candle-icon">🕯</div><div><strong>{candleCount.toLocaleString()}개의 촛불</strong><span>이 공간에 공개된 기도 지향</span></div></div>
          {intentions.length > 0 && <div className="intention-list"><h3>함께 봉헌된 기도</h3>{intentions.slice(0,4).map(item => <article key={item.id} className="intention-item"><span>🕯</span><p>{item.text}</p></article>)}</div>}
        </section>
        <section className="panel rosary-panel">
          <div className="section-kicker">02 / COMMUNITY ROSARY</div><h2>우리 본당의 묵주기도</h2><p className="section-intro">각자의 기도가 모여 공동체의 큰 기도가 됩니다.</p>
          <div className="rosary-stat"><span>함께 바친 묵주기도</span><strong>{decades.toLocaleString()}<small> 단</small></strong><span className="today-stat">오늘 +{todayDecades.toLocaleString()}단</span></div>
          <div className="progress-track"><span style={{width: progress + '%'}} /></div><div className="progress-label"><span>본당 공동 목표</span><strong>{progress}% · 1,000단</strong></div>
          <div className="rosary-art" aria-hidden="true"><div className="bead-loop">{Array.from({length:18},(_,i)=><i key={i} className={i%5===0?'large-bead':''} />)}</div><div className="rosary-cross">✝</div></div>
          <button className="primary-button rosary-button" onClick={contributeRosary}>묵주 5단 봉헌하기 <span>＋</span></button>
          <p className="micro-copy">{isConnected ? '본당 공동체와 실시간으로 동기화됩니다.' : '현재 데모 모드 · 이 브라우저에서만 숫자가 누적됩니다.'}</p>
        </section>
        <section className="panel chant-panel">
          <div className="section-kicker">03 / GREGORIAN CHANT</div><div className="chant-layout"><div><h2>고요히 흐르는 성가</h2><p className="section-intro">그레고리오 성가와 함께 기도의 시간을 가져보세요.</p><div className="track-title"><span className="sound-wave">♫</span><div><strong>Gregorian Chant</strong><small>{audioUrl ? '기도를 위한 배경 성가' : '음원 연결 대기 중'}</small></div></div></div><div className="audio-controls"><button className="play-button" onClick={toggleAudio} aria-label={isPlaying?'일시정지':'재생'}>{isPlaying?'Ⅱ':'▶'}</button><label className="volume-control">VOL <input type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label></div></div>
          {audioUrl && <audio ref={audioRef} src={audioUrl} loop onEnded={()=>setIsPlaying(false)} onPause={()=>setIsPlaying(false)} onPlay={()=>setIsPlaying(true)} />}
          <div className="chant-footnote">음원은 배포·공연·온라인 스트리밍 권한이 확인된 녹음 파일을 사용합니다.</div>
        </section>
      </div>
      <footer className="footer"><span>RELIGION © 2026</span><span>가상 기도 공간은 실제 미사와 성사를 대체하지 않습니다.</span></footer>
    </div>
  );
}
