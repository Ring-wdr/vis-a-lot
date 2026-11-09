import { Suspense } from "react";
import { BootScreen } from "@/shared/ui/Loading";
import { ShareView } from "@/views/share/ui/ShareView";

/** 공유 페이지. 공유 id는 query(?id=)로 받으므로 정적 export에서도 한 페이지로 된다. */
export default function SharePage() {
  return (
    <Suspense fallback={<BootScreen step="app" />}>
      <ShareView />
    </Suspense>
  );
}
