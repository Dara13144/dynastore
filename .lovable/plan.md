## What we'll add

Two tutorial videos managed by admin and shown to users:
1. **"How to top up balance"** — video appears at the top of the Topup modal
2. **"How to buy a game"** — video appears on every game detail page (`/games/:id`)

Admin uploads/edits these from a new **Tutorials** tab in the admin panel.

## Storage approach

Use **video URLs** (YouTube / Telegram / direct mp4 link) rather than uploading large mp4 files to storage. This is simpler, cheaper, and avoids the 50MB-per-bucket-object friction. YouTube/embed URLs get rendered in an iframe; direct mp4 links use a native `<video>` tag.

If you prefer actual file uploads to Cloud storage instead, tell me and I'll switch to a `tutorial-videos` storage bucket.

## Database

New table `public.tutorial_videos`:
- `slug` (text, unique) — `'topup'` or `'buy_game'`
- `title` (text)
- `video_url` (text)
- `description` (text, optional)
- `visible` (boolean)
- updated timestamps

RLS:
- Public can read rows where `visible = true`
- Admins can insert / update / delete

Seed two rows: `topup` and `buy_game` (empty URLs initially).

## Admin panel

- New **Tutorials** tab in `src/routes/admin.tsx`
- Form for each of the 2 slugs: title, video URL, description, visible toggle, save button
- Live preview of the embedded video

## User-facing display

- **TopupModal**: small "How to top up" banner at the top — click to expand and play
- **Game page** (`/games/:id`): "How to buy" section near the buy button — click to expand and play

Both fetch from the public table; hidden if not visible or URL empty.

## Files touched

- Migration: create `tutorial_videos` table + RLS + seed
- New: `src/components/admin/TutorialsTab.tsx`
- New: `src/components/TutorialVideo.tsx` (shared embed component, handles YouTube vs mp4)
- Edit: `src/routes/admin.tsx` — add tab
- Edit: `src/components/TopupModal.tsx` — show topup video
- Edit: `src/routes/games.$id.tsx` — show buy-game video

Confirm and I'll run the migration + build it.