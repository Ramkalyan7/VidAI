"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signupRequest } from "../../lib/api-client";
import { saveAuthSession } from "../../lib/auth-storage";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await signupRequest(email, password);
      saveAuthSession(data);
      router.push("/projects");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Signup failed."
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
          placeholder="Create a password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="confirmPassword" className="text-sm text-app-muted">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="input-shell"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button type="submit" className="button-primary mt-2" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <div className="text-sm text-app-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-white underline underline-offset-4">
          Sign in
        </Link>
      </div>
    </form>
  );
}
