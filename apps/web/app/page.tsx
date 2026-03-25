import { NavbarLayout } from "../components/layout/navbar";
import { PromptComposer } from "../components/home/prompt-composer";

export default function HomePage() {
  return (
    <NavbarLayout>
      <section className="flex min-h-[calc(100vh-120px)] items-center justify-center py-8">
        <div className="w-full max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              What video do you want to create?
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-app-muted sm:text-base">
              Describe your idea and VidAI will turn it into a short video with voice, captions, and style controls.
            </p>
          </div>

          <PromptComposer />
        </div>
      </section>
    </NavbarLayout>
  );
}
