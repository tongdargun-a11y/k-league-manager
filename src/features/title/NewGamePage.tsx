import { useEffect, useState } from 'react';
import type { GameMode } from '../../types';
import { MODE_CAPABILITIES, MODE_INFO } from '../../engine/modes';
import { Link, useSearchParams } from 'react-router-dom';
import { datasetRepository, type DatasetSummary } from '../../repositories/saveRepository';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { TEST_CLUBS, type SeasonLength } from '../../data';
import { PixelCharacter } from '../../components/PixelCharacter';
import { COUNTS, generateAppearance } from '../../engine/appearance';
import { USER_PLAYER_POSITIONS } from '../../engine/player/userPlayer';
import { POSITION_LABEL } from '../../engine/ratings/ovr';
import type { PlayerAppearance, Position } from '../../types';

const LOOK_PARTS: [keyof typeof COUNTS, string][] = [['hair', '헤어'], ['hairColor', '머리색'], ['skin', '피부'], ['eyes', '눈'], ['face', '얼굴형'], ['body', '체형'], ['facialHair', '수염'], ['accessory', '액세서리']];
import { generateTestSquad } from '../../data/testPlayers';
import { playerOvr } from '../../engine/ratings/ovr';
import { useGame } from '../../store/gameStore';
import { ClubBadge } from '../../components/ClubBadge';
import { TestDataBadge } from '../../components/TestDataBadge';

const squadInfo = Object.fromEntries(
  TEST_CLUBS.map((c) => {
    const squad = generateTestSquad(c, '2026-02-16');
    const top = squad.map(playerOvr).sort((a, b) => b - a).slice(0, 11);
    return [c.id, { avg: Math.round(top.reduce((a, b) => a + b, 0) / top.length), size: squad.length }];
  }),
);

function expectation(rep: number) {
  if (rep >= 82) return '우승 경쟁';
  if (rep >= 76) return '상위권 진입';
  if (rep >= 71) return '중위권 안착';
  return '잔류';
}

export function NewGamePage() {
  const navigate = useNavigate();
  const newGame = useGame((s) => s.newGame);
  const [name, setName] = useState('');
  const [params] = useSearchParams();
  const [clubId, setClubId] = useState<string | null>(params.get('club'));
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<GameMode>('manager');
  const [seasonLength, setSeasonLength] = useState<SeasonLength>('long');
  const [position, setPosition] = useState<Position>('CM');
  const [look, setLook] = useState<PlayerAppearance>(() => generateAppearance('new-player'));
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [datasetId, setDatasetId] = useState<string>(params.get('ds') ?? '');
  useEffect(() => { datasetRepository.list().then(setDatasets).catch(() => setDatasets([])); }, []);
  const ds = datasets.find((d) => d.id === datasetId);
  const club = TEST_CLUBS.find((c) => c.id === clubId);
  const canStart = name.trim().length >= 1 && !!clubId && !busy;

  const start = async () => {
    if (!canStart || !clubId) return;
    setBusy(true);
    await newGame(name.trim(), clubId, datasetId || null, mode, seasonLength, mode === 'player' ? { name: name.trim(), position, appearance: look } : undefined);
    navigate('/game');
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <button className="btn-ghost mb-6" onClick={() => navigate('/')}><ArrowLeft size={16} /> 타이틀</button>
      <h1 className="text-2xl font-black text-white">새 게임</h1>
      <p className="mt-1 text-sm text-slate-400">모드를 고르고 이름과 구단을 정하세요.</p>

      <section className="panel mt-6 p-5" aria-label="플레이 모드">
        <h2 className="panel-title">플레이 모드</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(Object.keys(MODE_INFO) as GameMode[]).map((m) => {
            const ok = MODE_CAPABILITIES[m].playable;
            return (
              <button key={m} type="button" disabled={!ok} data-testid={`mode-${m}`} onClick={() => setMode(m)}
                className={`rounded-lg border p-3 text-left transition ${mode === m ? 'border-gold-400 bg-navy-700' : 'border-navy-600 hover:border-navy-500'} ${ok ? '' : 'cursor-not-allowed opacity-50'}`}>
                <div className="font-bold text-white">{MODE_INFO[m].label} 모드</div>
                <div className="mt-1 text-xs text-slate-400">{MODE_INFO[m].desc}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">모드마다 세이브와 시즌 진행이 완전히 따로 저장됩니다.</p>
      </section>

      <section className="panel mt-4 p-5">
        <label className="panel-title" htmlFor="mgr">1. {MODE_INFO[mode].role} 이름</label>
        <input id="mgr" className="input mt-2 max-w-sm" maxLength={20} placeholder="예: 홍길동" value={name} onChange={(e) => setName(e.target.value)} />
        {mode === 'player' && (
          <div className="mt-4 flex flex-wrap items-start gap-5" data-testid="player-creator">
            <PixelCharacter a={look} className="h-36 w-32 rounded-lg" label="내 선수 미리보기" />
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">포지션
                <select className="input mt-1" value={position} onChange={(e) => setPosition(e.target.value as Position)} data-testid="player-position">
                  {USER_PLAYER_POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]} ({p})</option>)}
                </select>
              </label>
              {LOOK_PARTS.map(([k, label]) => (
                <label key={k} className="text-xs text-slate-400">{label}
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" className="btn-ghost px-2 py-1" onClick={() => setLook((l) => ({ ...l, [k]: ((l[k] ?? 0) + COUNTS[k] - 1) % COUNTS[k] }))} aria-label={`${label} 이전`}>‹</button>
                    <span className="w-6 text-center text-sm text-white">{(look[k] ?? 0) + 1}</span>
                    <button type="button" className="btn-ghost px-2 py-1" onClick={() => setLook((l) => ({ ...l, [k]: ((l[k] ?? 0) + 1) % COUNTS[k] }))} aria-label={`${label} 다음`}>›</button>
                  </div>
                </label>
              ))}
              <p className="text-xs text-slate-500 sm:col-span-2">18세 유망주로 시작합니다. 선발과 경기는 감독이 정하고, 나는 훈련과 경기 출전으로 성장합니다.</p>
            </div>
          </div>
        )}
      </section>

      <section className="panel mt-4 p-5">
        <h2 className="panel-title">2. 선수 데이터</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select className="input w-auto" value={datasetId} onChange={(e) => setDatasetId(e.target.value)} aria-label="선수 데이터">
            <option value="">기본 데이터 (가상 선수)</option>
            {datasets.map((d) => {
              // 현재 구단과 맞는 구단 id가 하나도 없으면 PHASE 0 이전에 만든 구버전 데이터셋 (삭제하지 않고 선택만 막음)
              const legacy = !d.clubIds.some((id) => TEST_CLUBS.some((c) => c.id === id));
              return <option key={d.id} value={d.id} disabled={legacy}>{d.name} · {d.playerCount}명{legacy ? ' (구버전 구단 데이터 · 사용 불가)' : ''}</option>;
            })}
          </select>
          <Link to="/import" className="text-sm text-gold-400 underline">CSV/JSON 가져오기</Link>
        </div>
        {ds && <p className="mt-2 text-xs text-slate-400">가져온 선수가 있는 구단({ds.clubIds.length}개)은 그 선수들로 구성되고, 인원이 22명보다 적으면 테스트 선수로 채웁니다. 나머지 구단은 테스트 선수를 씁니다. 아래 주전 평균은 테스트 데이터 기준입니다.</p>}
      </section>

      <section className="panel mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="panel-title">3. 구단 선택</h2>
          <TestDataBadge text="선수는 테스트용 가상 선수" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEST_CLUBS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setClubId(c.id)}
              aria-pressed={clubId === c.id}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                clubId === c.id ? 'border-gold-500 bg-navy-700' : 'border-navy-600 bg-navy-900 hover:border-navy-600 hover:bg-navy-800'}`}
            >
              <ClubBadge club={c} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{c.name}</div>
                <div className="truncate text-xs text-slate-400">{c.city} · {c.stadium}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">주전 평균</div>
                <div className="font-bold tabular-nums text-gold-400">{squadInfo[c.id].avg}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {club && (
        <section className="panel mt-4 flex flex-wrap items-center gap-4 p-5">
          <ClubBadge club={club} size={56} />
          <div className="flex-1">
            <div className="text-lg font-bold text-white">{club.name}</div>
            <div className="text-sm text-slate-400">이사회 목표: <span className="font-semibold text-gold-300">{expectation(club.reputation)}</span> · 선수단 {squadInfo[club.id].size}명 · 이적 예산 {(club.finances.transferBudget / 10000).toFixed(1)}억 원 (게임용 추정)</div>
          </div>
          <div className="flex gap-1 rounded-lg border border-navy-600 p-1 text-sm" role="radiogroup" aria-label="시즌 길이">
            {([['long', '정규 33라운드'], ['short', '짧은 22라운드']] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={seasonLength === k} data-testid={`season-${k}`} onClick={() => setSeasonLength(k)}
                className={`rounded px-3 py-1.5 ${seasonLength === k ? 'bg-gold-500 font-bold text-navy-950' : 'text-slate-300 hover:bg-navy-700'}`}>{l}</button>
            ))}
          </div>
          <button className="btn-gold px-6 py-3 text-base" disabled={!canStart} onClick={start}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 부임하기
          </button>
        </section>
      )}
      {!name.trim() && clubId && <p className="mt-2 text-sm text-gold-300">감독 이름을 입력하세요.</p>}
    </div>
  );
}
