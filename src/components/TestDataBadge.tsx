import { FlaskConical } from 'lucide-react';

export function TestDataBadge({ text = '테스트 데이터' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300" title="가상 세계관의 개발용 데이터입니다. 구단·선수는 모두 가상이며 능력치는 게임용 값입니다.">
      <FlaskConical size={12} /> {text}
    </span>
  );
}
