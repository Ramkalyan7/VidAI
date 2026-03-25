import { SignupForm } from "../../components/auth/signup-form";

export default function SignupPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-120px)] max-w-md items-center py-10">
      <div className="w-full">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Sign up
        </h1>

        <SignupForm />
      </div>
    </section>
  );
}
