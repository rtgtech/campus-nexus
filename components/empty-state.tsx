import type { ReactNode } from "react";
import { InboxIcon } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Empty className="w-full rounded-[10px] border border-outline-variant/70 bg-card/70 px-4 py-8 shadow-[0_12px_30px_rgba(27,27,35,0.04)] sm:p-8">
      <EmptyHeader className="w-full max-w-none">
        <EmptyMedia
          className="size-12 rounded-[10px] bg-primary-fixed text-primary"
          variant="icon"
        >
          <InboxIcon className="size-5" />
        </EmptyMedia>

        <EmptyTitle className="w-full max-w-none font-['Space_Grotesk'] text-xl font-bold tracking-tight text-on-background sm:text-2xl">
          {title}
        </EmptyTitle>

        {description ? (
          <EmptyDescription className="w-full max-w-none">
            {description}
          </EmptyDescription>
        ) : null}
      </EmptyHeader>

      {action ? (
        <EmptyContent className="w-full max-w-none">
          {action}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
