"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Project, getProjectsRequest } from "../../lib/api-client";

function getStatusPillClassName(status: string) {
  if (status === "finished") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "failed") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-app-line bg-white/[0.03] text-app-muted";
}

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
          className="rounded-[28px] border border-app-line bg-white/[0.02] p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="pill">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
                <span className="pill">Project</span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${getStatusPillClassName(project.videoStatus)}`}
                >
                  {project.videoStatus}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">
                {project.title || "Untitled project"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-app-muted">
                {project.videoStatus === "finished"
                  ? "Latest render is ready to view."
                  : project.videoStatus === "failed"
                    ? "Latest render failed. Open the project to retry with a new prompt."
                    : project.videoStatus === "pending"
                      ? "Latest render is in progress. This list will update automatically."
                      : "No render yet."}
              </p>
            </div>

            <div className="shrink-0">
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
