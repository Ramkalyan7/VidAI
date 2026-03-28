"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AiServiceOutput,
  Project,
  chatProjectRequest,
  getProjectRequest,
} from "../../../lib/api-client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function parseAssistantPayload(content: string): AiServiceOutput | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (!("code" in obj) || !("description" in obj) || !("error" in obj)) return null;

    return {
      code: typeof obj.code === "string" ? obj.code : null,
      description: typeof obj.description === "string" ? obj.description : null,
      error: typeof obj.error === "string" ? obj.error : null,
    };
  } catch {
    return null;
  }
}

function assistantPreviewText(content: string) {
  const payload = parseAssistantPayload(content);
  if (!payload) return content;
  return payload.description || payload.error || content;
}

function toChatMessages(project: Project): ChatMessage[] {
  return project.messages.map((msg) => ({
    id: msg.id,
    role: msg.role === "assistant" ? "assistant" : "user",
    content: msg.content,
  }));
}

export default function ChatClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError("");

    async function load() {
      try {
        const data = await getProjectRequest(projectId);
        if (!isMounted) return;

        setProject(data);
        setMessages(toChatMessages(data));
      } catch (loadError) {
        if (!isMounted) return;
        setLoadError(
          loadError instanceof Error ? loadError.message : "Failed to load project."
        );
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isLoading]);

  const latestAssistantPayload = useMemo(() => {
    for (const msg of [...messages].reverse()) {
      if (msg.role !== "assistant") {
        continue;
      }

      const payload = parseAssistantPayload(msg.content);
      if (payload) {
        return payload;
      }
    }

    return null;
  }, [messages]);

  const latestVideoSrc = useMemo(() => {
    if (!project?.videoUrl || project.videoStatus !== "finished") {
      return null;
    }

    const version = messages.at(-1)?.id ?? "latest";
    return `${project.videoUrl}?v=${encodeURIComponent(version)}`;
  }, [messages, project]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;

    setSendError("");
    setIsSending(true);
    setDraft("");

    const userTempId = `temp-user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userTempId, role: "user", content: trimmed }]);

    try {
      const output = await chatProjectRequest(projectId, trimmed);
      const assistantTempId = `temp-assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: assistantTempId, role: "assistant", content: JSON.stringify(output) },
      ]);

      const refreshedProject = await getProjectRequest(projectId);
      setProject(refreshedProject);
      setMessages(toChatMessages(refreshedProject));
    } catch (sendError) {
      setSendError(
        sendError instanceof Error ? sendError.message : "Failed to send message."
      );
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return <p className="mt-8 text-sm text-app-muted">Loading project...</p>;
  }

  if (loadError) {
    return (
      <div className="mt-8 rounded-3xl border border-app-line bg-black/20 p-5">
        <p className="text-sm text-red-400">{loadError}</p>
        <Link
          href="/projects"
          className="mt-4 inline-flex text-sm text-white underline underline-offset-4"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  return (
    <section className="h-[calc(100vh-6rem)]">
      <div className="grid h-full gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex h-full min-h-0 flex-col pr-4 lg:pr-6">
          <div className="border-b border-app-line pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-app-muted">Project</p>
                <h1 className="truncate text-lg font-semibold tracking-tight text-white">
                  {project?.title || "Untitled project"}
                </h1>
              </div>
              <Link href="/projects" className="button-secondary">
                All Projects
              </Link>
            </div>
          </div>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-4">
            <div className="grid gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-2xl rounded-3xl bg-white px-4 py-3 text-sm leading-6 text-black"
                      : "max-w-2xl rounded-3xl bg-white/[0.04] px-4 py-3 text-sm leading-6 text-app-text"
                  }
                >
                  {message.role === "assistant"
                    ? assistantPreviewText(message.content)
                    : message.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="pt-3">
            <div className="rounded-[26px] bg-white/[0.03] p-4">
              <textarea
                className="min-h-12 w-full resize-none bg-transparent text-sm leading-6 text-app-text outline-none placeholder:text-app-soft"
                placeholder="Reply with prompt changes, ask for a stronger hook, or request a new rendering style..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={isSending}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                {sendError ? (
                  <p className="text-xs text-red-400">{sendError}</p>
                ) : (
                  <span />
                )}
                <button
                  className="button-primary"
                  onClick={handleSend}
                  disabled={isSending || !draft.trim()}
                  type="button"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 flex-col border-l border-app-line pl-4 lg:pl-6">
          <div className="min-h-0 flex-1 py-4">
            <div className="h-full min-h-[420px] overflow-hidden rounded-[24px] bg-black ring-1 ring-white/6">
              <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)]">
                <div className="border-b border-app-line px-4 py-3">
                  <p className="text-xs text-app-muted">Latest Video</p>
                  <p className="mt-1 text-sm text-white">
                    {latestAssistantPayload?.description ||
                      latestAssistantPayload?.error ||
                      "No generation yet."}
                  </p>
                </div>
                <div className="border-b border-app-line bg-black px-4 py-4">
                  {latestVideoSrc ? (
                    <video
                      key={latestVideoSrc}
                      className="aspect-video w-full rounded-2xl bg-black"
                      controls
                      playsInline
                      preload="metadata"
                      src={latestVideoSrc}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : project?.videoStatus === "pending" ? (
                    <p className="text-sm text-app-muted">
                      Video render is in progress. The latest video will appear here once it is ready.
                    </p>
                  ) : (
                    <p className="text-sm text-app-muted">
                      Send a message to generate or refine the latest video.
                    </p>
                  )}
                </div>
                <div className="no-scrollbar min-h-0 overflow-auto p-4">
                  {latestAssistantPayload?.code ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-app-muted">Render Status</p>
                        <p className="mt-1 text-sm text-white">
                          {project?.videoStatus || "unknown"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-app-muted">Generated Code</p>
                        <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-app-text">
                          {latestAssistantPayload.code}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-app-muted">
                      Send a message to generate or refine the video.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
