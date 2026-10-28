import { Construction } from "lucide-react";
import { page } from "./feed-styles";
import { Localized } from "./Localized";

const p = page();

/** 아직 만들지 않은 화면: 제목과 들어갈 내용 한 줄. 다음 PR들이 이 자리를 화면으로 바꾼다. */
export function FeedPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className={p.root()}>
      <h1 className={p.title()}>{title}</h1>
      <p className={p.lead()}>{description}</p>
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong p-4 text-ui text-fg-muted">
        <Construction size={16} aria-hidden="true" />
        <Localized
          ko="다음 단계에서 만드는 화면입니다."
          en="This screen is coming in a later step."
        />
      </p>
    </div>
  );
}
