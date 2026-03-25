"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { createProjectRequest } from "../../lib/api-client";
import { getAuthToken } from "../../lib/auth-storage";

const PENDING_PROMPT_KEY = "vidai-pending-prompt";

export function PromptComposer() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const didAutoSubmitRef = useRef(false);

  async function submitPrompt(prompt: string) {
    setError("");

    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    if (!getAuthToken()) {
      sessionStorage.setItem(PENDING_PROMPT_KEY, prompt.trim());
      router.push("/login?redirect=/");
      return;
    }

    setIsSubmitting(true);

    try {
      const { projectId } = await createProjectRequest(prompt.trim());
      sessionStorage.removeItem(PENDING_PROMPT_KEY);
      router.push(`/chat/${projectId}`);
      router.refresh();
    } catch (submitError) {
      const messageText =
        submitError instanceof Error ? submitError.message : "Project creation failed.";

      if (messageText.toLowerCase().includes("sign in")) {
        sessionStorage.setItem(PENDING_PROMPT_KEY, prompt.trim());
        router.push("/login?redirect=/");
        return;
      }

      setError(messageText);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPrompt(message);
  }

  useEffect(() => {
    if (didAutoSubmitRef.current) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      return;
    }

    const pendingPrompt = sessionStorage.getItem(PENDING_PROMPT_KEY);
    if (!pendingPrompt?.trim()) {
      return;
    }

    didAutoSubmitRef.current = true;
    setMessage(pendingPrompt);
    submitPrompt(pendingPrompt);
  }, []);

  return (
    <form
      className="rounded-[28px] border border-app-line bg-black/30 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] sm:p-5"
      onSubmit={handleSubmit}
    >
      <textarea
        className="input-shell min-h-40 resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-7 placeholder:text-app-soft focus:border-0"
        placeholder="Create a 30-second short explaining why sunsets look red, with cinematic narration, bold captions, and a minimal black-and-white visual style."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={isSubmitting}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-app-line pt-4">
        <div className="flex flex-wrap gap-2">
          <span className="pill">30 sec</span>
          <span className="pill">English</span>
          <span className="pill">Narration</span>
          <span className="pill">Captions</span>
          <span className="pill">Monochrome</span>
        </div>

        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Generating..." : "Generate"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    </form>
  );
}
