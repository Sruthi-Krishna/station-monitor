import type { StatusCounts } from "@/lib/alarms";

export function AlarmBanner({ counts }: { counts: StatusCounts }) {
  const level = counts.FAULT > 0 ? "fault" : counts.WARNING > 0 ? "warning" : "ok";

  let message: string;
  if (counts.FAULT > 0) {
    message = `${counts.FAULT} ${counts.FAULT === 1 ? "instrument" : "instruments"} in fault`;
    if (counts.WARNING > 0) message += `, ${counts.WARNING} in warning`;
  } else if (counts.WARNING > 0) {
    message = `${counts.WARNING} ${counts.WARNING === 1 ? "instrument" : "instruments"} in warning`;
  } else {
    message = "All instruments nominal";
  }

  return (
    <div
      className={`banner banner-${level}`}
      role={level === "fault" ? "alert" : "status"}
      data-testid="alarm-banner"
    >
      {message}
    </div>
  );
}
