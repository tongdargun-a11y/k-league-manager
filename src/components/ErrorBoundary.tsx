import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="panel max-w-md p-6 text-center">
          <h1 className="text-lg font-bold text-white">문제가 발생했습니다</h1>
          <p className="mt-2 break-words text-sm text-slate-400">{this.state.error.message}</p>
          <p className="mt-2 text-xs text-slate-500">저장된 세이브는 브라우저에 남아 있습니다. 새로고침 후 이어하기를 눌러 주세요.</p>
          <button className="btn-gold mt-4" onClick={() => { window.location.href = '/'; }}>타이틀로</button>
        </div>
      </div>
    );
  }
}
