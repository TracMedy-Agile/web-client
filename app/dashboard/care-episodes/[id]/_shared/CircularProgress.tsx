import { clamp } from "./utils";

export function CircularProgress({
  percent,
  trackColor,
  progressColor,
  size = 128,
}: {
  percent: number | null;
  trackColor: string;
  progressColor: string;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedPercent = percent == null ? 0 : clamp(percent);
  const offset = circumference - (normalizedPercent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{percent == null ? "--" : `${normalizedPercent}%`}</span>
      </div>
    </div>
  );
}
