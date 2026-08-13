import { Suspense } from "react";
import { ViewPostRoute } from "@/components/viewpost-box";

export default function ViewPostModal() {
  return (
    <Suspense fallback={null}>
      <ViewPostRoute />
    </Suspense>
  );
}
