import { Severity } from "@/types";

interface TrafficLightProps {
  severity: Severity;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-6 h-6",
};

const colorClasses: Record<Severity, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

const labels: Record<Severity, string> = {
  green: "Standard",
  yellow: "Review",
  red: "Risk",
};

export function TrafficLight({ severity, size = "md" }: TrafficLightProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} ${colorClasses[severity]} rounded-full shadow-sm`} />
      <span
        className={`text-xs font-semibold uppercase tracking-wide ${
          severity === "green"
            ? "text-emerald-700 dark:text-emerald-400"
            : severity === "yellow"
              ? "text-amber-700 dark:text-amber-400"
              : "text-red-700 dark:text-red-400"
        }`}
      >
        {labels[severity]}
      </span>
    </div>
  );
}
