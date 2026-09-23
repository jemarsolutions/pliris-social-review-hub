"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const descriptions: Record<string, string> = {
  "review:read": "View Social Review Hub posts and their review status.",
  "wcs:write": "Add or update posts from PLIRIS WCS in the Hub.",
  offline_access:
    "Keep the connection available by refreshing authorization when needed.",
};

export default function ConsentForm({ scope }: { scope: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestedScopes = scope.split(" ").filter(Boolean);

  async function respond(accept: boolean) {
    setBusy(true);
    setError("");
    try {
      const oauthQuery = window.location.search.slice(1);
      const response = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept,
          scope: requestedScopes.join(" "),
          ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error("Unable to complete the authorization request.");
      // Better Auth represents OAuth redirects from JSON requests as
      // `{ redirect: true, url }`. The endpoint's OpenAPI schema calls this
      // field `redirect_uri`, but the runtime response uses `url`.
      const continuationUrl =
        result.redirect === true && typeof result.url === "string"
          ? result.url
          : typeof result.redirect_uri === "string"
            ? result.redirect_uri
            : null;
      if (!continuationUrl)
        throw new Error(
          "The authorization server did not return a continuation URL.",
        );
      window.location.assign(continuationUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to complete the authorization request.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-form">
        <div className="login-story">
          <p className="eyebrow">PLIRIS SOCIAL REVIEW HUB</p>
          <h1>Connect ChatGPT</h1>
          <p>Review the access requested before connecting this account.</p>
        </div>
        <div className="login-form">
          <h2>Requested access</h2>
          {requestedScopes.length ? (
            <ul>
              {requestedScopes.map((requestedScope) => (
                <li key={requestedScope}>
                  {descriptions[requestedScope] ||
                    `Access scope: ${requestedScope}`}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No access scopes were requested. Deny this connection and contact
              your Hub administrator.
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="consent-actions">
            <Button
              disabled={busy}
              onClick={() => respond(false)}
              variant="outline"
            >
              Deny
            </Button>
            <Button
              disabled={busy || requestedScopes.length === 0}
              onClick={() => respond(true)}
            >
              {busy ? "Connecting…" : "Allow access"}
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
