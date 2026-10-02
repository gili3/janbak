import { Component, ErrorInfo, ReactNode } from "react";

/** يمنع انهيار اللوحة إلى صفحة بيضاء عند حدوث خطأ غير متوقع في أي صفحة */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("خطأ في اللوحة:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="login">
        <h1>حدث خطأ غير متوقع</h1>
        <p className="muted">أعد تحميل الصفحة. إن تكرر الخطأ فأرسل النص التالي للمطوّر:</p>
        <p className="notice bad" dir="ltr">{this.state.error.message}</p>
        <button className="btn" onClick={() => location.reload()}>إعادة التحميل</button>
      </div>
    );
  }
}
