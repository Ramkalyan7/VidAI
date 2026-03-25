"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createProjectRequest } from "../../lib/api-client";
import { getAuthToken } from "../../lib/auth-storage";

export function PromptComposer() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    if (!getAuthToken()) {
      router.push("/login");
      return;
    }

    setIsSubmitting(true);

    try {
      await createProjectRequest(message.trim());
      router.push("/projects");
      router.refresh();
    } catch (submitError) {
      const messageText =
        submitError instanceof Error ? submitError.message : "Project creation failed.";

      if (messageText.toLowerCase().includes("sign in")) {
        router.push("/login");
        return;
      }

      setError(messageText);
    } finally {
      setIsSubmitting(false);
    }
  }

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
