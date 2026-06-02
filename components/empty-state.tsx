import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-outline-variant/70 bg-white/70 p-8 text-center shadow-[0_12px_30px_rgba(27,27,35,0.04)]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
        <span className="material-symbols-outlined">inbox</span>
      </div>
      <h2 className="mt-4 font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-on-background">
        {title}
      </h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
