# Continuous film evidence

- Live classic film: `/`
- Live continuous spike: `/?continuous=1` (same deployment; swap the query flag)

## Files

- `CONCEPT.md` — what felt page-like, the three directions, the chosen thread pull, the beat map.
- `full-1440.png`, `full-1280.png`, `full-375.png` — the hero as it lands at each width.
- `1440-*.jpg`, `1280-*.jpg`, `375-*.jpg` — eight paused frames per width, at 0.3, 1.6, 2.9,
  4.2, 5.5, 6.8, 8.1 and 9.4 seconds. The filename suffix is the playhead time.
- `continuous-film-1280.gif` — a 10-second, 10 fps loop of the take at 300 px wide. Use it to judge
  the camera move; use the frames for detail.
- `continuous-film-1280-recording.webm` — the raw 12.8 s Playwright recording (page load plus the
  full take), for the human eye and for anyone who wants the original capture.

## Reproduce

```bash
cd frontend
npm run build
npm run preview -- --port 4173 --host 127.0.0.1
node scripts/capture-continuous-film.mjs
```

The capture script assumes the preview is at `http://127.0.0.1:4173`; override with
`CAPTURE_BASE_URL`.
