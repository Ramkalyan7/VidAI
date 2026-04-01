"use client";

type RenderPreviewProps = {
  status?: string | null;
  videoSrc?: string | null;
  pendingMessage: string;
  failedMessage: string;
  idleMessage: string;
  containerClassName?: string;
  videoClassName?: string;
  controls?: boolean;
  muted?: boolean;
};

function StatusMessage({
  tone,
  title,
  message,
}: {
  tone: "pending" | "failed" | "idle";
  title: string;
  message: string;
}) {
  const icon =
    tone === "pending" ? (
      <span className="inline-flex h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
    ) : tone === "failed" ? (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-400/40 bg-red-500/10 text-lg font-semibold text-red-300">
        !
      </span>
    ) : (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-line bg-white/[0.04] text-[11px] font-semibold tracking-[0.24em] text-white">
        PLAY
      </span>
    );

  return (
    <div className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      {icon}
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">{title}</p>
        <p
          className={
            tone === "failed"
              ? "text-sm leading-6 text-red-300"
              : "text-sm leading-6 text-app-muted"
          }
        >
          {message}
        </p>
      </div>
    </div>
  );
}

export function RenderPreview({
  status,
  videoSrc,
  pendingMessage,
  failedMessage,
  idleMessage,
  containerClassName = "",
  videoClassName = "",
  controls = false,
  muted = true,
}: RenderPreviewProps) {
  if (status === "finished" && videoSrc) {
    return (
      <video
        key={videoSrc}
        className={videoClassName}
        controls={controls}
        muted={muted}
        playsInline
        preload="metadata"
        src={videoSrc}
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  if (status === "pending") {
    return (
      <div className={containerClassName}>
        <StatusMessage
          tone="pending"
          title="Rendering video"
          message={pendingMessage}
        />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className={containerClassName}>
        <StatusMessage
          tone="failed"
          title="Render failed"
          message={failedMessage}
        />
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <StatusMessage tone="idle" title="No render yet" message={idleMessage} />
    </div>
  );
}
