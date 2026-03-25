"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Project, getProjectsRequest } from "../../lib/api-client";

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
          <div className="flex min-h-40 items-center justify-center rounded-3xl bg-black ring-1 ring-white/6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-app-line bg-white text-[11px] font-semibold text-black">
              PLAY
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              <span className="pill">
                {new Date(project.createdAt).toLocaleDateString()}
              </span>
              <span className="pill">Project</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">
              {project.title || "Untitled project"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-app-muted">
              {project.messages[0]?.content ?? "No prompt saved yet."}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
