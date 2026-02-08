"use client";

interface Props {
  progress: number; // 0–100
  message?: string;
  timer?: string;
}

export default function ProgressBar({ progress, message, timer }: Props) {
  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between text-xs text-gunmetal-light">
        <span>{message ?? "Processing…"}</span>
        <div className="flex items-center gap-3">
          {timer && (
            <span className="font-mono text-xs text-gunmetal bg-silver-light/50 px-2 py-0.5 rounded-full">
              {timer}
            </span>
          )}
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-silver-light overflow-hidden">
        <div
          className="h-full rounded-full bg-sandy transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
