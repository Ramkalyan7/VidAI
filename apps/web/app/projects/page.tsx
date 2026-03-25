import { ProjectsList } from "../../components/projects/projects-list";

export default function ProjectsPage() {
  return (
    <section className="py-8">
      <div className="flex flex-col gap-4 border-b border-app-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="section-title">My Projects</h1>
          <p className="section-copy mt-2">
            All your VidAI video projects in one place. Open, duplicate, or continue working on any draft.
          </p>
        </div>
        <button className="button-primary">New Project</button>
      </div>

      <ProjectsList />
    </section>
  );
}
