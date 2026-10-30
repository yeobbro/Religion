'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.35);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) await supabase.auth.signInAnonymously();
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !parishId) return;
    const loadIntentions = async () => {
      const { data, error } = await supabase.from('prayer_intentions')
        .select('id, intention, created_at')
        .eq('parish_id', parishId).eq('is_public', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(20);
      if (!error) setIntentions((data ?? []).map(row => ({ id: row.id, text: row.intention, createdAt: row.created_at })));
    };
    void loadIntentions();
    const channel = supabase.channel('public-prayer-intentions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prayer_intentions', filter: `parish_id=eq.${parishId}` }, payload => {
        const row = payload.new as { id: string; intention: string; created_at: string; is_public: boolean; expires_at: string };
        if (row.is_public && row.expires_at > new Date().toISOString()) {
          setIntentions(items => [{ id: row.id, text: row.intention, createdAt: row.created_at }, ...items.filter(item => item.id !== row.id)].slice(0, 20));
        }
      }).subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  const candleCount = intentions.length;

  const addIntention = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = intention.trim();
    if (text.length < 3) { setNotice('기도 지향을 세 글자 이상 입력해 주세요.'); return; }
    setLoading(true); setNotice('');
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
        const { data } = await supabase.from('prayer_intentions').select('id, intention, created_at')
          .eq('parish_id', parishId).eq('is_public', true).order('created_at', { ascending: false }).limit(20);
        setIntentions((data ?? []).map(row => ({ id: row.id, text: row.intention, createdAt: row.created_at })));
      } else setNotice('기도 지향을 비공개로 봉헌했어요.');
      else if (isPublic) setIntentions(items => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...items]);
      else setNotice('기도 지향을 비공개로 봉헌했어요.');
    } else {
      if (isPublic) setIntentions(items => [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...items]);
      else setNotice('기도 지향을 이 브라우저에서 비공개로 봉헌했어요. (데모 모드)');
    }
    setIntention(''); setLoading(false);
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
        <section className="panel prayer-guide-panel">
          <div className="section-kicker">02 / A MOMENT OF PRAYER</div><h2>마음을 모으는 짧은 기도</h2><p className="section-intro">잠시 멈추고 마음을 가다듬으며, 오늘의 기도를 시작해 보세요.</p>
          <div className="prayer-guide-visual"><span>✝</span><i></i></div>
          <blockquote className="prayer-quote">“주님, 제 마음 안에 머무르시고<br/>오늘의 걸음을 평화로 이끌어 주소서.”</blockquote>
          <p className="micro-copy">잠시 침묵한 뒤, 마음에 담긴 기도 지향을 봉헌해 보세요.</p>
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
