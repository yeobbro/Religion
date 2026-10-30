# Religion

A shared online prayer space for parish communities, beginning with a Catholic experience. The platform is designed so religion-specific spaces and practices remain modular.

## Current milestone
- Prayer candles with written intentions and a public/private choice.
- Gregorian chant player with playback controls. Audio is supplied by the deployment through `NEXT_PUBLIC_GREGORIAN_AUDIO_URL`; only recordings with verified usage rights should be used.

## Run locally

```bash
corepack enable
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Without Supabase credentials, the UI runs in local demo mode. Demo contributions are stored in the current browser only and are not shared across devices. Configure Supabase, enable **Anonymous Sign-Ins** under Authentication → Providers, and apply `supabase/migrations/0001_prayer_community.sql` to enable candle offerings and the public prayer-intention feed. Create a row in `public.parishes`, then set `NEXT_PUBLIC_PARISH_ID` to that row's UUID. Anonymous sessions let visitors contribute without a full account; production deployments should add abuse controls (rate limits / CAPTCHA) and a parish-admin moderation workflow. Shared parish rosary totals are intentionally deferred to a later milestone.

## Environment
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_PARISH_ID` — UUID of a row in `public.parishes`.
- `NEXT_PUBLIC_GREGORIAN_AUDIO_URL` — optional URL override; by default the player uses the public-domain `Veni Sancte Spiritus` recording by Membeth, served from `apps/web/public/audio` (credits in `apps/web/public/audio/CREDITS.md`).

## Privacy and pastoral boundaries
- Prayer intentions are private by default. Public intentions are shown only after the user opts in.
- Do not collect sensitive personal details in public intentions.
- The virtual candle, rosary counter, and prayer space support personal and communal devotion; they do not replace Mass, confession, Eucharist, or other in-person sacraments.

## Architecture direction
- `apps/web`: Next.js experience
- `supabase/migrations`: persistence and access policies
- Future: Colyseus multiplayer server, 3D spaces, avatars, and religion-specific modules.


## Gregorian chant audio credit
The default player audio is **Veni Sancte Spiritus (Gregorian chant)**, recorded and released into the public domain by Membeth. [Wikimedia Commons file page](https://commons.wikimedia.org/wiki/File:Veni.sancte.spiritus.ogg). The chant is the Pentecost sequence; replace the default URL with another appropriately licensed recording if a different liturgical season or repertoire is desired.
