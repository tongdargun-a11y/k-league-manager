import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileUp, Trash2 } from 'lucide-react';
import { CSV_TEMPLATE, parseInput, validateAndBuild, type ImportResult } from '../../engine/import/importPlayers';
import { TEST_CLUBS, DEFAULT_SEASON_YEAR } from '../../data';
import { datasetRepository, type DatasetSummary } from '../../repositories/saveRepository';
import { playerOvr } from '../../engine/ratings/ovr';
import { useGame } from '../../store/gameStore';
import { Panel } from '../../components/ui';

function downloadText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const clubName = (id: string) => TEST_CLUBS.find((c) => c.id === id)?.name ?? id;

export function ImportPage() {
  const navigate = useNavigate();
  const toast = useGame((s) => s.toast);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [name, setName] = useState('');
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  const refresh = () => datasetRepository.list().then(setDatasets).catch(() => setDatasets([]));
  useEffect(() => { void refresh(); }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setParseError(null);
    setFileName(file.name);
    setName(file.name.replace(/\.(csv|json)$/i, ''));
    if (file.size > 5 * 1024 * 1024) { setParseError('파일이 너무 큽니다 (최대 5MB).'); return; }
    const text = await file.text();
    const parsed = parseInput(text, file.name);
    if (parsed.error) { setParseError(parsed.error); return; }
    setResult(validateAndBuild(parsed.records, { clubs: TEST_CLUBS, fileName: file.name, today: new Date().toISOString().slice(0, 10), seasonYear: DEFAULT_SEASON_YEAR }));
  };

  const errors = result?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? [];

  const save = async () => {
    if (!result || !result.players.length) return;
    await datasetRepository.add({ name: name || fileName, fileName, players: result.players });
    toast(`데이터셋 '${name || fileName}' 저장 완료 (${result.players.length}명). 새 게임에서 선택할 수 있습니다.`, 'success');
    setResult(null);
    setFileName('');
    setConfirmed(false);
    void refresh();
  };

  const downloadErrors = () => {
    const rows = ['row,field,level,message', ...(result?.issues ?? []).map((i) => `${i.row},${i.field},${i.level},"${i.message.replace(/"/g, '""')}"`)];
    downloadText(rows.join('\n'), `import-errors-${fileName}.csv`, 'text/csv');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
      <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> 뒤로</button>
      <div>
        <h1 className="text-2xl font-black text-white">선수 데이터 가져오기</h1>
        <p className="mt-1 text-sm text-slate-400">직접 입력했거나 이용 권한을 확인한 선수 데이터(CSV 또는 JSON)를 가져와 <b>새 게임</b>에 사용할 수 있습니다. 진행 중인 세이브는 바뀌지 않습니다.</p>
      </div>

      <Panel title="1. 파일 선택">
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-gold cursor-pointer">
            <FileUp size={16} /> CSV / JSON 파일 선택
            <input type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button className="btn-ghost" onClick={() => downloadText(CSV_TEMPLATE, 'k-league-manager-template.csv', 'text/csv')}><Download size={16} /> CSV 양식 받기</button>
          {fileName && <span className="text-sm text-slate-300">{fileName}</span>}
        </div>
        <details className="mt-3 text-xs text-slate-400">
          <summary className="cursor-pointer text-slate-300">열(컬럼) 안내</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>필수</b>: id(고유 ID), name(이름), clubId(구단 ID 또는 구단명), position(포지션, 여러 개면 ST|LW)</li>
            <li>구단 ID: {TEST_CLUBS.map((c) => `${c.id}(${c.shortName})`).join(', ')}</li>
            <li>선택: nationality, birthDate(YYYY-MM-DD) 또는 age, shirtNumber, heightCm, weightKg, foot(left/right/both), ovr, potential, contractEnd, wage(주급, 만원), apps/goals/assists(실제 통산 기록), source(출처), sourceUpdatedAt(기준일)</li>
            <li>능력치 열(finishing, pace 등 25개)을 모두 넣으면 그대로 사용하고, 없으면 OVR에 맞춰 <b>게임용 추정치</b>를 만듭니다.</li>
            <li>선수 사진은 가져오지 않습니다. 권리가 확인되지 않은 사진은 사용하지 않습니다.</li>
          </ul>
        </details>
        {parseError && <p className="mt-3 flex items-center gap-2 text-sm text-rose-300"><AlertTriangle size={14} /> {parseError}</p>}
      </Panel>

      {result && (
        <>
          <Panel title="2. 검사 결과">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>전체 {result.totalRows}행</span>
              <span className="text-emerald-300">가져올 선수 {result.players.length}명</span>
              <span className={errors.length ? 'text-rose-300' : 'text-slate-400'}>오류 {errors.length}건 (해당 행 제외)</span>
              <span className={warnings.length ? 'text-gold-300' : 'text-slate-400'}>경고 {warnings.length}건</span>
              {result.issues.length > 0 && <button className="text-xs text-gold-400 underline" onClick={downloadErrors}>오류·경고 목록 내려받기</button>}
            </div>
            {result.issues.length > 0 && (
              <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-xs">
                {result.issues.slice(0, 200).map((i, k) => (
                  <li key={k} className={i.level === 'error' ? 'text-rose-300' : 'text-gold-300'}>
                    {i.row > 0 ? `${i.row}행` : '전체'} · {i.field}: {i.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {Object.entries(result.perClub).map(([id, n]) => <span key={id} className="rounded bg-navy-700 px-2 py-0.5">{clubName(id)} {n}명</span>)}
            </div>
          </Panel>

          <Panel title="3. 미리보기">
            <div className="max-h-80 overflow-auto">
              <table className="table-base">
                <thead><tr><th>이름</th><th>구단</th><th>포지션</th><th>생년월일</th><th>OVR</th><th>능력치</th><th>실제 통산</th><th>출처</th></tr></thead>
                <tbody>
                  {result.players.slice(0, 100).map((p) => (
                    <tr key={p.id}>
                      <td className="text-white">{p.name}</td>
                      <td>{clubName(p.clubId)}</td>
                      <td className="text-xs">{p.positions.join(' · ')}</td>
                      <td className="text-xs">{p.birthDate}</td>
                      <td className="font-bold">{playerOvr(p)}</td>
                      <td className="text-xs">{p.attributesSource === 'imported' ? '가져옴' : '추정'}</td>
                      <td className="text-xs">{p.externalCareer ? `${p.externalCareer.appearances}경기 ${p.externalCareer.goals}골` : '-'}</td>
                      <td className="max-w-[160px] truncate text-xs text-slate-400">{p.meta.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.players.length > 100 && <p className="mt-2 text-xs text-slate-500">처음 100명만 표시합니다.</p>}
          </Panel>

          <Panel title="4. 저장">
            <label className="block max-w-sm text-sm">
              <span className="text-xs text-slate-400">데이터셋 이름</span>
              <input className="input mt-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              이 데이터를 사용할 권리가 있음을 확인했습니다. (직접 입력했거나 이용 조건이 허용하는 자료)
            </label>
            <button className="btn-gold mt-3" disabled={!result.players.length || !confirmed} onClick={save}><CheckCircle2 size={16} /> 데이터셋으로 저장</button>
          </Panel>
        </>
      )}

      <Panel title="저장된 데이터셋">
        {datasets.length === 0 ? <p className="text-sm text-slate-400">아직 없습니다.</p> : (
          <ul className="divide-y divide-navy-700">
            {datasets.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="flex-1">
                  <div className="font-semibold text-white">{d.name}</div>
                  <div className="text-xs text-slate-400">{d.fileName} · {d.playerCount}명 · {d.clubIds.length}개 구단 · {new Date(d.importedAt).toLocaleString('ko-KR')}</div>
                </div>
                <button className="rounded p-1.5 text-slate-500 hover:bg-navy-700 hover:text-rose-300" aria-label="삭제"
                  onClick={async () => { if (window.confirm(`'${d.name}' 데이터셋을 삭제할까요? 이미 만든 세이브에는 영향이 없습니다.`)) { await datasetRepository.remove(d.id); void refresh(); } }}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
