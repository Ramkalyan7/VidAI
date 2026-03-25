const messages = [
  {
    role: "assistant",
    text: "Your latest project is ready. I created a 30-second version with bold captions and a calmer voiceover.",
  },
  {
    role: "user",
    text: "Make it a little faster and add one stronger opening line.",
  },
  {
    role: "assistant",
    text: "Done. I tightened the pacing in the first 8 seconds and updated the hook for a more immediate start.",
  },
];

export default function ChatPage() {
  return (
    <section className="h-[calc(100vh-6rem)]">
      <div className="grid h-full gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex h-full min-h-0 flex-col pr-4 lg:pr-6">
          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            <div className="grid gap-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-2xl rounded-3xl bg-white px-4 py-3 text-sm leading-6 text-black"
                      : "max-w-2xl rounded-3xl bg-white/[0.04] px-4 py-3 text-sm leading-6 text-app-text"
                  }
                >
                  {message.text}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3">
            <div className="rounded-[26px] bg-white/[0.03] p-4">
              <textarea
                className="min-h-12 w-full resize-none bg-transparent text-sm leading-6 text-app-text outline-none placeholder:text-app-soft"
                placeholder="Reply with prompt changes, ask for a stronger hook, or request a new rendering style..."
              />

              <div className="mt-3 flex items-center justify-end">
                <button className="button-primary">Send</button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col border-l border-app-line pl-4 lg:pl-6">
          <div className="flex min-h-0 flex-1 items-center justify-center py-2">
            <div className="flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-[24px] bg-black">
              <video className="h-full w-full object-contain" controls preload="metadata">
                <source src="" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
