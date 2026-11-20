import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronRight,
  Mail,
  MessagesSquare,
  Activity,
  X,
} from "lucide-react";
import type { View } from "../game/view";
import { bulletins, latestSeq, type Bulletin } from "./notifications";

export function BoardWire({
  v,
  muted,
  reading,
  travelling,
  open,
}: {
  v: View;
  muted: string[];
  reading: string | null;
  travelling: boolean;
  open: (item?: Bulletin) => void;
}) {
  const cursor = useRef(latestSeq(v));
  const anchor = useRef<HTMLDivElement>(null),
    [outside, setOutside] = useState(false);
  useEffect(() => {
    const node = anchor.current!;
    const observer = new IntersectionObserver(
      ([entry]) => setOutside(entry.intersectionRatio < 0.7),
      { root: node.closest(".game-view"), threshold: [0, 0.7, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const [queue, setQueue] = useState<Bulletin[]>([]),
    [held, setHeld] = useState(false);
  useEffect(() => {
    const fresh = bulletins(v, cursor.current, muted);
    cursor.current = Math.max(cursor.current, latestSeq(v));
    if (fresh.length)
      setQueue((previous) =>
        [
          ...previous,
          ...fresh.filter(
            (item) => item.kind !== "chat" || item.thread !== reading,
          ),
        ].slice(-30),
      );
  }, [v, muted, reading]);
  const current = queue.find((item) =>
    item.kind === "market"
      ? !travelling
      : item.thread !== reading &&
        !muted.includes(
          v.chat.find((message) => message.id === item.id)?.from ?? "",
        ),
  );
  useEffect(() => {
    if (!current || held) return;
    const timer = setTimeout(
      () =>
        setQueue((previous) =>
          previous.filter((item) => item.id !== current.id),
        ),
      6500,
    );
    return () => clearTimeout(timer);
  }, [current, held]);
  const dismiss = () =>
    setQueue((previous) => previous.filter((item) => item.id !== current?.id));
  const Icon = !current
    ? Bell
    : current.kind === "market"
      ? Activity
      : current.thread
        ? Mail
        : MessagesSquare;
  const content = (
    <>
      <button
        className="wire-story"
        type="button"
        title={
          current ? `${current.title}: ${current.text}` : "Mitteilungen öffnen"
        }
        onClick={() => {
          open(current);
          if (current) dismiss();
        }}
      >
        <Icon size={16} />
        <span role="status" aria-live="polite" aria-atomic="true">
          <strong>{current?.title ?? "Mitteilungen"}</strong>
          {current && <small>{current.text}</small>}
        </span>
        <ChevronRight size={13} />
      </button>
      {current && (
        <button
          className="wire-dismiss"
          title="Mitteilung ausblenden"
          onClick={dismiss}
        >
          <X size={14} />
        </button>
      )}
    </>
  );
  const interaction = {
    onMouseEnter: () => setHeld(true),
    onMouseLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
    },
  };
  const slot =
    outside &&
    current &&
    anchor.current?.closest(".game-view")?.querySelector(".top-wire-slot");
  return (
    <div
      ref={anchor}
      className={`board-wire ${current && !slot ? "has-news" : ""}`}
      {...interaction}
    >
      {slot
        ? createPortal(
            <div className="board-wire has-news raised-wire" {...interaction}>
              {content}
            </div>,
            slot,
          )
        : content}
    </div>
  );
}
