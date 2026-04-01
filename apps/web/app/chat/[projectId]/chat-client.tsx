"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AiServiceOutput,
  Project,
  chatProjectRequest,
  getProjectRequest,
} from "../../../lib/api-client";
import { RenderPreview } from "../../../components/projects/render-preview";

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

  useEffect(() => {
    if (project?.videoStatus !== "pending") {
      return;
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function pollProject() {
      try {
        const refreshedProject = await getProjectRequest(projectId);
        if (isCancelled) return;

        setProject(refreshedProject);
        setMessages(toChatMessages(refreshedProject));

        if (refreshedProject.videoStatus === "pending") {
          timeoutId = setTimeout(pollProject, 4000);
        }
      } catch {
        if (!isCancelled) {
          timeoutId = setTimeout(pollProject, 6000);
        }
      }
    }

    timeoutId = setTimeout(pollProject, 4000);

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [project?.videoStatus, projectId]);



  const latestVideoSrc = useMemo(() => {
    if (!project?.videoUrl || project.videoStatus !== "finished") {
      return null;
    }

    const version = messages.at(-1)?.id ?? "latest";
    return `${project.videoUrl}?v=${encodeURIComponent(version)}`;
  }, [messages, project]);

  const previewStatus = isSending ? "pending" : project?.videoStatus;
  const previewVideoSrc = isSending ? null : latestVideoSrc;

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
              <RenderPreview
                status={previewStatus}
                videoSrc={previewVideoSrc}
                pendingMessage="Working on your update..."
                failedMessage="The latest render did not complete. Edit the prompt and send another message to try again."
                idleMessage="Send a message to generate or refine the latest video."
                containerClassName="flex h-full rounded-[24px] bg-black"
                videoClassName="h-full w-full rounded-[24px] bg-black"
                controls
                muted={false}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
