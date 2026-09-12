import { CampusShell } from "@/components/campus-shell";
import { ChatWorkspace } from "@/components/chat-workspace";

export default async function ChatPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const thread = Array.isArray(params.thread) ? params.thread[0] : params.thread;
  return <CampusShell active="messages"><ChatWorkspace initialThread={thread} /></CampusShell>;
}
