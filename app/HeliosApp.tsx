"use client";

import { useState } from "react";
import { HeliosProvider } from "@reactor-models/helios";
import { GUIDES, type Guide } from "./lib/guide";
import { CharacterSelect } from "./components/CharacterSelect";
import { Game } from "./components/Game";

// JWT resolver passed to <HeliosProvider jwtToken>.
//
// `@reactor-team/js-sdk` 3.x takes a `JwtSource` — a static string or a
// resolver. Pass the resolver so the SDK can mint a fresh JWT on every
// Reactor API hop — uploads, clip manifests, ICE refreshes, SDP
// renegotiation. With a static string those hops 401 the moment the
// token ages out.
//
// The token is memoized HERE, in module scope, until shortly before it
// expires — and the fetch itself is `no-store`, so the browser HTTP
// cache is out of the picture. This matters because the token is
// session-scoped: a session can only be operated by the exact token
// that created it, so every hop of a session must present the same JWT.
// Relying on the browser cache for that breaks the moment it misses
// (DevTools "Disable cache", cache eviction): the resolver then mints a
// fresh token with no bound sessions and every upload/clip call 403s.
//
// Known edge this does not cover: a session created just before the
// memoized token expires is orphaned at the re-mint (the fresh token
// isn't bound to it). Fixing that requires re-minting with
// `authorization_details.resources.sessions.bind` naming the live
// session.
const TOKEN_REFRESH_SKEW_MS = 60_000;
let cachedToken: { jwt: string; expiresAtMs: number } | null = null;
let inflightToken: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  if (
    cachedToken &&
    Date.now() < cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS
  ) {
    return cachedToken.jwt;
  }
  // Coalesce the parallel hops the SDK fires at connect time into one mint.
  if (inflightToken) return inflightToken;
  inflightToken = (async () => {
    try {
      const r = await fetch("/api/reactor/token", { cache: "no-store" });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Token fetch failed: ${r.status}`);
      }
      const { jwt, expires_at } = (await r.json()) as {
        jwt: string;
        expires_at: number;
      };
      cachedToken = { jwt, expiresAtMs: expires_at * 1000 };
      return jwt;
    } finally {
      inflightToken = null;
    }
  })();
  return inflightToken;
}

// The client tree. First the character select screen; once a guide is
// picked, the game with that guide for the rest of the visit (reload the
// page to choose again).
//
// HeliosProvider owns the WebRTC connection lifecycle — it
// auto-disconnects on unmount and on `beforeunload`, so don't call
// connect()/disconnect() from a useEffect yourself. No `autoConnect`: the
// guide is readable offline, and connecting spends GPU time, so the player
// chooses when to bring the video in.
export function HeliosApp() {
  const [guide, setGuide] = useState<Guide | null>(null);

  if (!guide) return <CharacterSelect guides={GUIDES} onSelect={setGuide} />;

  return (
    <HeliosProvider jwtToken={fetchToken}>
      <Game guide={guide} />
    </HeliosProvider>
  );
}
