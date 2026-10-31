import type { Message } from "@throughline/shared";
import { t, type Language } from "@throughline/shared";
import { clockTime } from "../lib/format";

/** A message on the line: plain text, no bubble, no avatar. The patient's own words align right. */
export function MessageBlock({ message, lang }: { message: Message; lang: Language }) {
  const mine = message.direction === "in";
  return (
    <div className={`max-w-[34ch] pb-6 text-[17px] ${mine ? "ml-auto text-right" : ""}`}>
      <p className="text-[13px] text-ink-soft">
        {mine ? t(lang, "patient.you") : t(lang, "patient.from_throughline")}{" "}
        <span className="tabular-nums">{clockTime(message.at)}</span>
      </p>
      <p lang={message.language} className="mt-1">
        {message.text}
      </p>
    </div>
  );
}
