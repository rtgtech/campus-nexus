import { CampusShell } from "@/components/campus-shell";
import { getDemoData } from "@/lib/campus-api";
import { fallbackMessages, profileAvatar, type MessagesData } from "@/lib/demo-data";

export default async function ChatPage() {
  const messagesData = await getDemoData<MessagesData>("/api/messages", fallbackMessages);
  const activeConversation = messagesData.conversations.find((conversation) => conversation.active) ?? messagesData.conversations[0];

  return (
    <CampusShell active="messages">
      <div className="overflow-hidden rounded-[30px] border border-outline-variant/60 bg-white shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
        <div className="grid min-h-[76vh] md:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-outline-variant/50 bg-surface-container-low md:border-b-0 md:border-r">
            <div className="border-b border-outline-variant/50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-on-background">Chat</h1>
                  <p className="mt-1 text-sm text-on-surface-variant">4 conversations • 2 unread</p>
                </div>
                <button className="rounded-2xl bg-primary p-2 text-on-primary">
                  <span className="material-symbols-outlined">edit_square</span>
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-outline-variant/50 bg-white px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-on-surface-variant">search</span>
                  <input
                    className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    placeholder="Search chats"
                    type="text"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 overflow-auto">
                {["All", "Unread", "Groups", "Campus"].map((tab, index) => (
                  <button
                    key={tab}
                    className={[
                      "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold",
                      index === 0 ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-outline-variant/35">
              {messagesData.conversations.map((conversation) => (
                <button
                  key={conversation.name}
                  className={[
                    "flex w-full items-center gap-4 px-5 py-4 text-left transition",
                    conversation.active ? "bg-white" : "hover:bg-white/70",
                  ].join(" ")}
                >
                  <div className="relative">
                    <img
                      alt={`${conversation.name} avatar`}
                      className="h-14 w-14 rounded-2xl object-cover"
                      src={conversation.avatar ?? profileAvatar}
                    />
                    {conversation.active ? (
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-secondary" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-on-surface">{conversation.name}</p>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        {conversation.time}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.16em] text-secondary/80">
                      {conversation.role ?? "Campus chat"}
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-on-surface-variant">
                        {conversation.typing ? "typing..." : conversation.preview}
                      </p>
                      {conversation.unread ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[11px] font-bold text-white">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[64vh] flex-col">
            <header className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-4 md:px-6">
              <div className="flex min-w-0 items-center gap-4">
                <img
                  alt={`${activeConversation?.name ?? "Chat"} avatar`}
                  className="h-12 w-12 rounded-2xl object-cover"
                  src={activeConversation?.avatar ?? profileAvatar}
                />
                <div className="min-w-0">
                  <h2 className="truncate font-['Space_Grotesk'] text-xl font-bold text-on-background">
                    {activeConversation?.name ?? "Campus Chat"}
                  </h2>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">
                    {activeConversation?.typing ? "Typing now" : "Active now"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {["videocam", "call", "info"].map((icon) => (
                  <button key={icon} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container">
                    <span className="material-symbols-outlined">{icon}</span>
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1 space-y-5 bg-surface-container-low px-5 py-6 md:px-6">
              <div className="flex justify-center">
                <span className="rounded-full bg-surface-container px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
                  Today
                </span>
              </div>

              {messagesData.messages.map((message, index) => {
                const isRight = message.side === "right";
                return (
                  <div key={`${message.side}-${index}`} className={isRight ? "flex justify-end" : "flex justify-start"}>
                    <div className={isRight ? "flex max-w-[82%] flex-col items-end" : "flex max-w-[82%] gap-3"}>
                      {!isRight ? (
                        <img alt="Sender avatar" className="mt-1 h-8 w-8 rounded-full object-cover" src={profileAvatar} />
                      ) : null}
                      <div>
                        <div
                          className={[
                            "rounded-[24px] px-4 py-3 text-sm leading-7 shadow-sm",
                            isRight
                              ? "rounded-br-md bg-primary text-on-primary"
                              : "rounded-bl-md border border-outline-variant/45 bg-white text-on-surface",
                          ].join(" ")}
                        >
                          {message.text}
                        </div>
                        <div
                          className={[
                            "mt-1 flex gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant",
                            isRight ? "justify-end" : "justify-start",
                          ].join(" ")}
                        >
                          {message.time ? <span>{message.time}</span> : null}
                          {message.status ? <span>{message.status}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {activeConversation?.typing ? (
                <div className="flex items-center gap-3">
                  <img alt="Typing avatar" className="h-8 w-8 rounded-full object-cover" src={profileAvatar} />
                  <div className="flex gap-1 rounded-full border border-outline-variant/45 bg-white px-4 py-3">
                    <span className="h-2 w-2 rounded-full bg-on-surface-variant" />
                    <span className="h-2 w-2 rounded-full bg-on-surface-variant/70" />
                    <span className="h-2 w-2 rounded-full bg-on-surface-variant/40" />
                  </div>
                </div>
              ) : null}
            </div>

            <footer className="border-t border-outline-variant/50 bg-white px-5 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <button className="rounded-2xl bg-surface-container p-3 text-primary">
                  <span className="material-symbols-outlined">add</span>
                </button>
                <button className="rounded-2xl bg-surface-container p-3 text-primary">
                  <span className="material-symbols-outlined">photo_camera</span>
                </button>
                <input
                  className="h-14 flex-1 rounded-2xl border border-outline-variant/50 bg-surface-container-low px-5 text-sm outline-none focus:border-primary"
                  placeholder="Message Nisha..."
                  type="text"
                />
                <button className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary">
                  Send
                </button>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </CampusShell>
  );
}
