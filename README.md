# Religion

A shared online prayer space for parish communities, beginning with a Catholic experience. The platform is designed so religion-specific spaces and practices remain modular.

## Current milestone
- Prayer candles with written intentions and a public/private choice.
- Parish-wide shared rosary decade counter, with a Supabase-backed contribution ledger and realtime updates when configured.
- Gregorian chant player with playback controls. Audio is supplied by the deployment through `NEXT_PUBLIC_GREGORIAN_AUDIO_URL`; only recordings with verified usage rights should be used.

## Run locally

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Without Supabase credentials, the UI runs in local demo mode. Demo contributions are stored in the current browser only and are not shared across devices. Configure Supabase and apply `supabase/migrations/0001_prayer_community.sql` to enable shared persistence and realtime updates.

## Environment
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_PARISH_ID` — parish UUID after creating a parish row; local demo accepts a slug.
- `NEXT_PUBLIC_GREGORIAN_AUDIO_URL` — URL to a properly licensed audio recording.

## Privacy and pastoral boundaries
- Prayer intentions are private by default. Public intentions are shown only after the user opts in.
- Do not collect sensitive personal details in public intentions.
- The virtual candle, rosary counter, and prayer space support personal and communal devotion; they do not replace Mass, confession, Eucharist, or other in-person sacraments.

## Architecture direction
- `apps/web`: Next.js experience
- `supabase/migrations`: persistence and access policies
- Future: Colyseus multiplayer server, 3D spaces, avatars, and religion-specific modules.
