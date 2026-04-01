"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Project, getProjectsRequest } from "../../lib/api-client";
import { RenderPreview } from "./render-preview";

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        const data = await getProjectsRequest();

        if (isMounted) {
          setProjects(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load projects."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!projects.some((project) => project.videoStatus === "pending")) {
      return;
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function pollProjects() {
      try {
        const data = await getProjectsRequest();
        if (isCancelled) return;

        setProjects(data);

        if (data.some((project) => project.videoStatus === "pending")) {
          timeoutId = setTimeout(pollProjects, 5000);
        }
      } catch {
        if (!isCancelled) {
          timeoutId = setTimeout(pollProjects, 7000);
        }
      }
    }

    timeoutId = setTimeout(pollProjects, 5000);

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [projects]);

  if (isLoading) {
    return <p className="mt-8 text-sm text-app-muted">Loading projects...</p>;
  }

  if (error) {
    return (
      <div className="mt-8 rounded-3xl border border-app-line bg-black/20 p-5">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/login" className="mt-4 inline-flex text-sm text-white underline underline-offset-4">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="mt-8 rounded-3xl border border-app-line bg-black/20 p-5">
        <p className="text-sm text-app-muted">
          No projects yet. Create your first one from the home page prompt box.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8">
      {projects.map((project) => (
        <article
          key={project.id}
          className="grid gap-5 border-b border-app-line pb-8 last:border-b-0 last:pb-0 lg:grid-cols-[220px_minmax(0,1fr)]"
        >
          <Link
            href={`/chat/${project.id}`}
            className="flex min-h-40 items-center justify-center rounded-3xl bg-black ring-1 ring-white/6"
          >
            <RenderPreview
              status={project.videoStatus}
              videoSrc={
                project.videoStatus === "finished" && project.videoUrl
                  ? `${project.videoUrl}?v=${encodeURIComponent(project.id)}`
                  : null
              }
              pendingMessage="Render in progress. This card refreshes automatically."
              failedMessage="Last render failed. Open the project to try again."
              idleMessage="Open the project to start the first render."
              containerClassName="h-full w-full rounded-3xl bg-black"
              videoClassName="h-full min-h-40 w-full rounded-3xl bg-black object-cover"
            />
          </Link>

          <div>
            <div className="flex flex-wrap gap-2">
              <span className="pill">
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
              <span className="pill">Project</span>
              <span className="pill uppercase tracking-[0.16em]">
                {project.videoStatus}
              </span>
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">
              {project.title || "Untitled project"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              {project.videoStatus === "finished"
                ? project.videoUrl
                  ? "Latest render is ready to view."
                  : "Render finished, but no video URL is available yet."
                : project.videoStatus === "failed"
                  ? "Latest render failed. Open the project to retry with a new prompt."
                  : project.videoStatus === "pending"
                    ? "Latest render is in progress. This list will update automatically."
                    : "No render yet."}
            </p>

            <div className="mt-5">
              <Link href={`/chat/${project.id}`} className="button-secondary">
                Open Chat
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
