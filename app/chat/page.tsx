import { CampusShell } from "@/components/campus-shell";
import { ChatWorkspace } from "@/components/chat-workspace";

export default async function ChatPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const value = params.thread ?? params.thred;
  const thread = Array.isArray(value) ? value[0] : value;
  return <CampusShell active="messages"><ChatWorkspace initialThread={thread} /></CampusShell>;
}
