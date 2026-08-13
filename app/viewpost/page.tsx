import { Suspense } from "react";
import { ViewPostRoute } from "@/components/viewpost-box";

export default function ViewPostPage() {
  return (
    <Suspense fallback={null}>
      <ViewPostRoute returnHref="/" />
    </Suspense>
  );
}
