# Deviations from the static design

Hard Rule 3: no layout, content, copy, route, flow or functionality changes. These are the only
departures, each minimal and each for motion/robustness.

## 1. The auth bootstrap state is now the desk's boot screen

- **Before:** while `/api/auth/me` resolved, `ProtectedRoute`/`PlatformRoute` rendered the old shadcn
  spinner — a blue ring on a white page.
- **Now:** the field (`#0e1f15`…`--field`) with the mono note "Reading the desk".
- **Why:** it is a pre-content loading state that was never part of the approved static design, and it
  was the first thing a cold load painted (a white flash, then blue). The motion brief asks for no
  flash of unanimated content and no janky first paint. The approved pages themselves are unchanged.
- **Where:** `frontend/src/App.tsx` (one small component, used by the two guards).

## 2. The motion token block moved out of `home.css`

- **Before:** nine `--m-*` declarations sat inside `.mm-home`.
- **Now:** the same nine declarations sit on `:root` in `frontend/src/app/motion.css`.
- **Why:** one production, one set of easings/durations (Hard Rule 2). The brief explicitly allows
  promoting the token declaration block and nothing else in a homepage file.
- **Proof:** computed values identical (0 differences), the homepage pixel-identical at 1280 before and
  after, page height unchanged, hero beat still animating. See `decisions.md` D2.
- **Where:** `frontend/src/components/home/home.css` (removed 9 lines), `frontend/src/app/motion.css`
  (added the block).

## 3. Class names and data attributes were added to existing elements

- `m-lift` / `m-fade` / `m-stamp` / `m-slip` on a handful of containers, `data-copied` on the form
  link slip, `m-meter` on the collection meter, and `className` on `EmptyState`.
- **Why:** hooks for the shared CSS. None of them has any style outside `motion.css`, so removing the
  stylesheet restores the static DOM's rendering exactly (verified: identical layout boxes and
  identical pixels with the sheet removed, except text antialiasing on one line).

## 4. No structural or flow change

No route, flow, copy, layout or API change. Nothing was moved to make motion easier. The drawer's
missing exit animation is the consequence of keeping the close path (and URL) instant.

## 5. `index.html` was not touched

The white/blue flash came from the auth guard, not the HTML shell; `html` already paints `#07110b`
(commit `3caf886`).
