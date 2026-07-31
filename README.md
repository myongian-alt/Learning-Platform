# Penbook

An infinite-canvas teaching platform: teachers assign interactive lessons (PDFs,
slides, images, links, blank pages), students write/draw/annotate/upload directly
on them, and teachers see all of it happening live with real-time annotation,
raise-hand, and reporting. See [ROADMAP.md](./ROADMAP.md) for how the full
feature set maps onto what's implemented so far.

## Stack

- **App**: Expo SDK 57 (New Architecture), Expo Router, TypeScript, React Native Web
- **Styling**: NativeWind (Tailwind for React Native)
- **State**: Zustand (client/UI state) + TanStack Query (server state)
- **Canvas**: `@shopify/react-native-skia` + `react-native-gesture-handler` +
  `react-native-reanimated` for the infinite drawing surface
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, RLS)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run web                  # or `npm run ios` / `npm run android`
```

Without `.env.local` configured, the app still boots (auth/data screens render
in a clearly-labeled disconnected state) so you can review the UI before wiring
up a backend.

### Setting up the Supabase backend

1. Create a Supabase project (via the [dashboard](https://supabase.com/dashboard)
   or the Supabase MCP tools if you're driving this from an agent).
2. Apply the schema in [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql):
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
3. Copy your project URL + anon key into `.env.local`.
4. Once schema changes settle, regenerate types to replace the hand-written
   `src/types/database.ts`:
   ```bash
   npx supabase gen types typescript --project-id <your-project-ref> > src/types/database.ts
   ```

The schema is RLS-first: teachers get full control over their own classes and
assignments (plus co-teachers), students can only see published assignments for
classes they've joined, and every student's submissions/strokes are readable by
the teacher of that class and writable only by the student themselves (or the
teacher, for annotation strokes). See the policies at the bottom of the
migration file for the exact rules.

## Project structure

```
src/
  app/
    (auth)/            sign-in, sign-up
    (teacher)/          dashboard, assignments, classes, library, reports (tab group)
    (student)/          home, assignments, portfolio (tab group)
    canvas/[assignmentId].tsx   the infinite-canvas assignment view (student)
    live/[assignmentId].tsx    the live monitoring dashboard (teacher)
  components/
    canvas/             InfiniteCanvas (Skia) + toolbar
    teacher/            StudentTile (live grid)
    ui/                 shared Button / TextField
  hooks/
    queries/            TanStack Query hooks, one per data need
  store/                Zustand stores (auth session, canvas tool state)
  lib/                  supabase client, query client, auth actions, join codes
  types/database.ts     hand-written types mirroring the SQL schema
supabase/
  migrations/0001_init.sql   full schema + RLS policies
```

## Scripts

- `npm run web` / `ios` / `android` — run the app
- `npm run lint` — ESLint (`eslint-config-expo`)
- `npm run format` — Prettier (with `prettier-plugin-tailwindcss` class sorting)

## Deploying

- **Mobile builds**: `eas build --profile preview` (see `eas.json` for profiles);
  requires `npx eas login` and an Expo account.
- **OTA updates**: `eas update --channel preview`
- **Web**: `npx expo export -p web` then deploy the `dist/` folder to Vercel/Netlify,
  or connect the repo directly for git-based deploys.
