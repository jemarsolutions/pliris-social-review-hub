"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <section className="login-story">
        <div className="wordmark">
          PLIRIS <span>SOCIAL REVIEW HUB</span>
        </div>
        <div>
          <p className="eyebrow">A CLEARER WAY TO REVIEW</p>
          <h1>
            Good content.
            <br />
            Confident decisions.
          </h1>
          <p>
            One place to review the week ahead,
            <br />
            refine the details, and give your approval.
          </p>
        </div>
        <small>Private prototype · Mac / Jemar</small>
      </section>
      <section className="login-form">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch("/api/auth/sign-in/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: f.get("email"),
                  password: f.get("password"),
                }),
              });
              if (!r.ok)
                throw new Error(
                  "Unable to sign in. Check your email and password.",
                );
              window.location.href = "/";
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to your workspace</h2>
          <p>Use the account created for you.</p>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={busy} className="full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <small>Access is by invitation. Contact Mac for an account.</small>
        </form>
      </section>
    </main>
  );
}
