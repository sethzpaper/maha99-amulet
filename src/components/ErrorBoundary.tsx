import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-3xl p-8 shadow-lg text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-slate-500 mb-6">
              {this.state.error?.message || 'ไม่สามารถโหลดหน้าเว็บได้'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-sky-600 text-white rounded-2xl hover:bg-sky-700 transition text-sm font-semibold"
            >
              รีโหลดหน้า
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
