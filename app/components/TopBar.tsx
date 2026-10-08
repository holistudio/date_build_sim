"use client";

import { useHelios, type HeliosStateMessage } from "@reactor-models/helios";

// Connection status and transport. Every state of the connection
// (disconnected → connecting → waiting → ready) is shown, because a
// session does not reach `ready` instantly and the wait needs a label.
const TONE: Record<string, { dot: string; label: string }> = {
  disconnected: { dot: "bg-ink/30", label: "Offline" },
  connecting: { dot: "bg-amber-400 animate-pulse", label: "Connecting…" },
  waiting: { dot: "bg-amber-400 animate-pulse", label: "Waiting for GPU…" },
  ready: { dot: "bg-emerald-400", label: "Connected" },
};

export function TopBar({ snapshot }: { snapshot: HeliosStateMessage | null }) {
  const { status, lastError, connect, disconnect, pause, resume } =
    useHelios();
  const tone = TONE[status] ?? TONE.disconnected;

  return (
    <header className="border-b-2 border-blush/30 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <h1 className="text-base font-extrabold text-ink md:text-lg">
          PC Build Route <span className="text-blush">♡</span>
        </h1>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/70">
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            <span className="hidden sm:inline">{tone.label}</span>
          </span>

          {snapshot &&
            (snapshot.running ? (
              <BarButton onClick={() => pause()}>❚❚ Pause</BarButton>
            ) : (
              <BarButton onClick={() => resume()}>▶ Resume</BarButton>
            ))}

          {status === "disconnected" ? (
            <BarButton primary onClick={() => connect()}>
              Connect
            </BarButton>
          ) : (
            <BarButton onClick={() => disconnect()}>Disconnect</BarButton>
          )}
        </div>
      </div>
      {lastError && (
        <p className="mx-auto max-w-6xl px-4 pb-2 text-xs font-semibold text-red-600">
          {lastError.message}
        </p>
      )}
    </header>
  );
}

function BarButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold transition-opacity hover:opacity-90 ${
        primary
          ? "bg-blush text-white"
          : "border border-ink/20 bg-white text-ink"
      }`}
    >
      {children}
    </button>
  );
}
