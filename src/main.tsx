import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  showDetails: boolean;
  copied: boolean;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack || null });

    try {
      const payload = {
        name: error?.name || "Error",
        message: error?.message || String(error),
        stack: error?.stack || null,
        componentStack: info.componentStack || null,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };
      localStorage.setItem("tokenicode_last_react_error", JSON.stringify(payload));
    } catch {
      // ignore persistence errors
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, componentStack: null, showDetails: false });
  };

  handleClearAndReload = () => {
    try {
      localStorage.removeItem("tokenicode-settings");
      localStorage.removeItem("tokenicode_custom_previews");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  handleToggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  handleCopyDiagnostics = async () => {
    try {
      const report = {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // fallback
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "An unexpected error occurred.";
      const isError300 = errorMsg.includes("error #300") || errorMsg.includes("300");

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            padding: 24,
            boxSizing: "border-box",
            position: "relative",
            zIndex: 10000,
          }}
        >
          <div
            style={{
              maxWidth: 640,
              width: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 20,
              padding: "32px 28px",
              boxShadow: "0 20px 48px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                marginBottom: 16,
              }}
            >
              ⚠️
            </div>

            <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 600, color: "#18181b" }}>
              Something went wrong
            </h2>

            <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#71717a", lineHeight: 1.6, maxWidth: 520 }}>
              {errorMsg}
            </p>

            {isError300 && (
              <div
                style={{
                  margin: "0 0 20px 0",
                  padding: "10px 14px",
                  borderRadius: 10,
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  fontSize: 12,
                  color: "#b45309",
                  textAlign: "left",
                  lineHeight: 1.5,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <strong>React 19 Invariant Violation (#300 didRenderTooFewHooks):</strong>
                <div style={{ marginTop: 4 }}>
                  组件在重新渲染时执行的 Hook 数量少于挂载渲染，请通过下方诊断信息定位具体组件。
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 16 }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: "8px 20px",
                  borderRadius: 10,
                  border: "1px solid #e4e4e7",
                  background: "#ffffff",
                  color: "#18181b",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "all 0.15s ease",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                }}
              >
                Retry
              </button>
              <button
                onClick={this.handleClearAndReload}
                style={{
                  padding: "8px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "#8B6CC5",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  boxShadow: "0 2px 8px rgba(139, 108, 197, 0.3)",
                }}
              >
                Clear data & Reload
              </button>
              <button
                onClick={this.handleCopyDiagnostics}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid #e4e4e7",
                  background: "#f4f4f5",
                  color: "#3f3f46",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {this.state.copied ? "✓ Copied" : "Copy Error Details"}
              </button>
              {(this.state.componentStack || this.state.error?.stack) && (
                <button
                  onClick={this.handleToggleDetails}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "#71717a",
                    cursor: "pointer",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  {this.state.showDetails ? "Hide Details" : "Show Details"}
                </button>
              )}
            </div>

            {this.state.showDetails && (
              <div
                style={{
                  width: "100%",
                  maxHeight: 260,
                  overflowY: "auto",
                  padding: "12px 14px",
                  borderRadius: 10,
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  color: "#e4e4e7",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 11,
                  textAlign: "left",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  boxSizing: "border-box",
                }}
              >
                {this.state.componentStack ? (
                  <>
                    <div style={{ color: "#a1a1aa", marginBottom: 6, fontWeight: 600 }}>Component Stack:</div>
                    <div>{this.state.componentStack}</div>
                    <div style={{ color: "#a1a1aa", margin: "12px 0 6px 0", fontWeight: 600 }}>Error Stack:</div>
                    <div>{this.state.error?.stack || "No error stack available"}</div>
                  </>
                ) : (
                  <div>{this.state.error?.stack || "No stack trace available"}</div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
