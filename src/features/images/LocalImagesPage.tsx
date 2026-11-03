import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Trash2 } from 'lucide-react';
import { TEST_CLUBS } from '../../data';
import { ClubBadge } from '../../components/ClubBadge';
import { Panel } from '../../components/ui';
import { clubImageKey, useLocalImages } from '../../store/localImages';
import { LocalImageButton } from './LocalImageButton';

export function LocalImagesPage() {
  const navigate = useNavigate();
  const count = useLocalImages((s) => Object.keys(s.urls).length);
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> 뒤로</button>
      <div>
        <h1 className="text-2xl font-black text-white">개인용 로고·사진</h1>
        <p className="mt-1 flex gap-2 text-sm text-slate-400">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-gold-400" />
          <span>직접 가지고 있는 이미지 파일을 <b>이 브라우저에만</b> 저장해 개인적으로 플레이할 때 표시합니다. 서버로 올라가거나 게임 배포본에 포함되지 않으며, 다른 사람과 공유하면 안 됩니다. 선수 사진은 선수 상세 화면에서 추가할 수 있습니다.</span>
        </p>
      </div>
      <Panel title="구단 로고">
        <ul className="divide-y divide-navy-700">
          {TEST_CLUBS.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <ClubBadge club={c} size={36} />
              <span className="flex-1 text-sm text-white">{c.name}</span>
              <LocalImageButton imageKey={clubImageKey(c.id)} label="로고" />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="전체 삭제">
        <p className="mb-2 text-sm text-slate-400">저장된 개인용 이미지 {count}개</p>
        <button className="btn-ghost" disabled={!count} onClick={() => { if (window.confirm('개인용 로고·사진을 모두 삭제할까요?')) void useLocalImages.getState().clear(); }}>
          <Trash2 size={16} /> 모두 삭제
        </button>
      </Panel>
    </div>
  );
}
