import { FlaskConical } from 'lucide-react';

export function TestDataBadge({ text = '테스트 데이터' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300" title="실제 K리그 데이터가 아닌 개발용 가상 데이터입니다. 능력치는 게임용 추정치입니다.">
      <FlaskConical size={12} /> {text}
    </span>
  );
}
