# Smart Library Management System
React (Vite) + Express + SQLite (better-sqlite3), JWT auth with bcrypt-hashed passwords. All free, no paid APIs.

## Structure
- `server/server.js` – REST API, schema, seed data (auto-creates `library.db` on first run)
- `client/src/App.jsx` – login, sidebar layout, all dashboards; `api.js` – fetch helper; `styles.css` – white/blue theme

## Run locally (Node 18+)
```
npm run setup        # installs server + client deps
npm run server       # terminal 1 -> http://localhost:4000
npm run client       # terminal 2 -> http://localhost:5173
```
Demo logins: `admin@library.com / admin123` (Admin tab) · `student1@library.com / student123` (Student tab, up to student5). Or register a new student.

## Rules
14-day loans, ₹5/day overdue fine (change `FINE_PER_DAY`, `LOAN_DAYS`, `MAX_BOOKS` in `server.js`), max 3 books per student.

## Deploy (single service)
```
npm run setup && npm run build
JWT_SECRET=<long-random-string> PORT=4000 npm start
```
Express serves the built React app and the API together. On Render/Railway/Fly (free tiers) use build `npm run setup && npm run build`, start `npm start`, set `JWT_SECRET`, and attach a persistent disk with `DB_FILE=/data/library.db` — SQLite is a file, so without a disk the data resets on redeploy. For a VPS: run with `pm2` behind nginx.
