"use client";

/** Live days / hours / minutes / seconds countdown to an escrow deadline. */
export function EscrowCountdown({
  deadline,
  now,
}: {
  deadline: bigint;
  now: bigint;
}) {
  if (now >= deadline) {
    return (
      <div
        className="escrow-countdown escrow-countdown--expired"
        role="status"
        aria-label="Deadline has passed"
      >
        <span className="pill pill--done">Deadline passed</span>
      </div>
    );
  }

  const remaining = Number(deadline - now);
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return (
    <div
      className="escrow-countdown"
      role="timer"
      aria-label={`Deadline in ${days}d ${hours}h ${minutes}m ${seconds}s`}
    >
      <CountdownUnit value={days} label="days" />
      <span className="escrow-countdown__sep" aria-hidden="true">:</span>
      <CountdownUnit value={hours} label="hrs" />
      <span className="escrow-countdown__sep" aria-hidden="true">:</span>
      <CountdownUnit value={minutes} label="min" />
      <span className="escrow-countdown__sep" aria-hidden="true">:</span>
      <CountdownUnit value={seconds} label="sec" />
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="escrow-countdown__unit">
      <span className="escrow-countdown__digit">
        {String(value).padStart(2, "0")}
      </span>
      <span className="escrow-countdown__label">{label}</span>
    </div>
  );
}
