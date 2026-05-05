import { CampusShell } from "@/components/campus-shell";

const conversations = [
  { name: "Chloe Mitchell", preview: "You going to the Nexus Party tonight?", time: "Just now", active: true },
  { name: "CS 301 Study Group", preview: "Does anyone have the notes for...", time: "12m ago" },
  { name: "Jordan Hayes", preview: "Sent a photo", time: "1h ago" },
  { name: "Sarah Jenkins", preview: "That project was wild, glad it's done!", time: "Yesterday" },
];

const messages = [
  { side: "left", text: "Have you seen the lineup for the Campus Nexus festival? The main stage looks unreal." },
  { side: "right", text: "I did. I am in if the early bird access is still open for Nexus Points holders." },
  { side: "left", text: "There are a few left. I already grabbed mine and the poster looks excellent too." },
  { side: "right", text: "Send me the link. I do not want to miss that one." },
] as const;

export default function MessagesPage() {
  return (
    <CampusShell active="messages">
      <div className="overflow-hidden rounded-[30px] border border-outline-variant/60 bg-white shadow-[0_18px_50px_rgba(27,27,35,0.08)]">
        <div className="grid min-h-[72vh] md:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-outline-variant/50 bg-surface-container-low md:border-b-0 md:border-r">
            <div className="border-b border-outline-variant/50 p-5">
              <div className="flex items-center justify-between">
                <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-on-background">Messages</h1>
                <button className="rounded-2xl bg-primary p-2 text-on-primary">
                  <span className="material-symbols-outlined">edit_square</span>
                </button>
              </div>
              <div className="mt-4 flex gap-2 overflow-auto">
                {["All", "Friends", "Groups", "Unread"].map((tab, index) => (
                  <button
                    key={tab}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap",
                      index === 0 ? "bg-primary text-on-primary" : "bg-white text-on-surface-variant",
                    ].join(" ")}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-outline-variant/35">
              {conversations.map((conversation) => (
                <button
                  key={conversation.name}
                  className={[
                    "flex w-full items-center gap-4 px-5 py-4 text-left transition",
                    conversation.active ? "bg-white" : "hover:bg-white/70",
                  ].join(" ")}
                >
                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                      <span className="material-symbols-outlined">
                        {conversation.name.includes("Group") ? "groups" : "person"}
                      </span>
                    </div>
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
                    <p className="truncate text-sm text-on-surface-variant">{conversation.preview}</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[60vh] flex-col">
            <header className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-4 md:px-6">
              <div className="flex items-center gap-4">
                <img
                  alt="Chloe Mitchell"
                  className="h-12 w-12 rounded-2xl object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmpD6cfKc-Dh3JQvkAIvvA4nGaCzgmv378CT-89HCyw5qq4O4BbuTtqQgLCmgtxR6asoWEMT-G24o3pnnHldbHPatXaQeHxNLjkuM1F89J9i6woQs8C34ERV_5ZqFsToCNW6Xb4hNBq8ET5Be81vDhDiIAnXsbMRMBdV--c81WRbSW5j1v72ah1oi_EzH13c8QHZFyDHbe0kJ8Frid9eM5I08DlVfz3EdVTvweHHRB1iORUVIU9Q30jEkxyk5qfu2jYEGZ6PuxS80"
                />
                <div>
                  <h2 className="font-['Space_Grotesk'] text-xl font-bold text-on-background">Chloe Mitchell</h2>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-secondary">Active now</p>
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

              {messages.map((message, index) => (
                <div
                  key={`${message.side}-${index}`}
                  className={message.side === "right" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-sm",
                      message.side === "right"
                        ? "rounded-br-md bg-primary text-on-primary"
                        : "rounded-bl-md border border-outline-variant/45 bg-white text-on-surface",
                    ].join(" ")}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <footer className="border-t border-outline-variant/50 bg-white px-5 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <button className="rounded-2xl bg-surface-container p-3 text-primary">
                  <span className="material-symbols-outlined">add</span>
                </button>
                <input
                  className="h-14 flex-1 rounded-2xl border border-outline-variant/50 bg-surface-container-low px-5 text-sm outline-none focus:border-primary"
                  placeholder="Type a message..."
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
