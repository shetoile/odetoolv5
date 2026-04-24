import React, { type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";

type StartupFailure = {
  title: string;
  message: string;
  detail: string | null;
};

function formatFailure(error: unknown, fallbackTitle: string): StartupFailure {
  if (error instanceof Error) {
    return {
      title: fallbackTitle,
      message: error.message || fallbackTitle,
      detail: error.stack ?? null
    };
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return {
      title: fallbackTitle,
      message: error.trim(),
      detail: null
    };
  }

  try {
    return {
      title: fallbackTitle,
      message: JSON.stringify(error),
      detail: null
    };
  } catch {
    return {
      title: fallbackTitle,
      message: fallbackTitle,
      detail: null
    };
  }
}

function StartupFailureView({ failure }: { failure: StartupFailure }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(180deg, rgba(3,18,34,0.98), rgba(1,12,24,1))",
        color: "#edf7ff",
        fontFamily: '"Chakra Petch", "Barlow", "Segoe UI", sans-serif'
      }}
    >
      <div
        style={{
          width: "min(920px, 100%)",
          borderRadius: "24px",
          border: "1px solid rgba(55,145,205,0.24)",
          background: "rgba(4, 21, 37, 0.92)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
          padding: "24px"
        }}
      >
        <div
          style={{
            fontSize: "0.78rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#29afe3"
          }}
        >
          Startup Error
        </div>
        <h1
          style={{
            margin: "12px 0 0",
            fontSize: "1.7rem",
            lineHeight: 1.2
          }}
        >
          {failure.title}
        </h1>
        <p
          style={{
            margin: "14px 0 0",
            fontSize: "0.98rem",
            lineHeight: 1.7,
            color: "#cfe4f2",
            whiteSpace: "pre-wrap"
          }}
        >
          {failure.message}
        </p>
        {failure.detail ? (
          <pre
            style={{
              margin: "18px 0 0",
              padding: "16px",
              borderRadius: "16px",
              border: "1px solid rgba(55,145,205,0.18)",
              background: "rgba(1, 12, 24, 0.88)",
              color: "#9bb9cf",
              fontSize: "0.85rem",
              lineHeight: 1.55,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}
          >
            {failure.detail}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  failure: StartupFailure | null;
};

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    failure: null
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      failure: formatFailure(error, "The desktop application crashed while rendering.")
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const failure = formatFailure(error, "The desktop application crashed while rendering.");
    this.setState({
      failure: {
        ...failure,
        detail: [failure.detail, info.componentStack].filter(Boolean).join("\n\n")
      }
    });
  }

  render() {
    if (this.state.failure) {
      return <StartupFailureView failure={this.state.failure} />;
    }
    return this.props.children;
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("The application root container was not found.");
}

const root = ReactDOM.createRoot(container);

function showFailure(error: unknown, fallbackTitle: string) {
  root.render(<StartupFailureView failure={formatFailure(error, fallbackTitle)} />);
}

window.addEventListener("error", (event) => {
  showFailure(event.error ?? event.message, "The desktop application failed during startup.");
});

window.addEventListener("unhandledrejection", (event) => {
  showFailure(event.reason, "The desktop application hit an unhandled startup error.");
});

async function start() {
  try {
    const { default: App } = await import("@/App");
    root.render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    showFailure(error, "The desktop application could not finish loading.");
  }
}

void start();
