"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginRequest } from "../../lib/api-client";
import { saveAuthSession } from "../../lib/auth-storage";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await loginRequest(email, password);
      saveAuthSession(data);
      const redirectTarget = searchParams.get("redirect");
      router.push(
        redirectTarget && redirectTarget.startsWith("/") ? redirectTarget : "/projects"
      );
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Login failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm text-app-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input-shell"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm text-app-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input-shell"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button type="submit" className="button-primary mt-2" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <div className="text-sm text-app-muted">
        Don&apos;t have an account?{" "}
        <Link
          href={
            searchParams.get("redirect")
              ? `/signup?redirect=${encodeURIComponent(searchParams.get("redirect")!)}`
              : "/signup"
          }
          className="text-white underline underline-offset-4"
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}
