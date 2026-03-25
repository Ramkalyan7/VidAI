import { LoginForm } from "../../components/auth/login-form";

export default function LoginPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-120px)] max-w-md items-center py-10">
      <div className="w-full">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Sign in
        </h1>

        <LoginForm />
      </div>
    </section>
  );
}
