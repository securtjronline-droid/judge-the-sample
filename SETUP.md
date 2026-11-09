# Setup and running

## Required tools

- Node.js **24 LTS**, including npm. The pinned dependencies also accept Node 20.19+ or 22.12+.
- Git for cloning/checking out the GitHub project.
- Bash: Terminal on macOS/Linux, or Git Bash/WSL on Windows.
- A modern browser.

The app runs in the browser. Node/npm manage dependencies, development, production builds, and automated statistical tests.

## First run

Open a Bash terminal in the directory containing `package.json` and `run_app.sh`:

```bash
node --version
npm --version
npm ci
npm run check:data
npm run test:stats
npm run test:ui
bash run_app.sh
```

Open the printed address, normally **http://127.0.0.1:5173**. Press **Ctrl+C** to stop.

The launcher enters its own directory, checks Node compatibility, and runs `npm ci` if dependencies are missing or the lockfile changed. Initial installation needs npm registry access.

## Development and production

Run these separately, stopping a server before starting another:

```bash
npm run dev
npm run build
npm run preview
```

Development uses port 5173; production preview uses port 4173. The build output is `dist/`.

Dependencies are pinned in `package.json` and `package-lock.json`. Use `npm ci` for an existing checkout. When deliberately changing a dependency, use `npm install --save-exact PACKAGE@VERSION` and commit both package files.

## Troubleshooting

- **Node/npm not found:** install Node, reopen the terminal, and repeat the checks.
- **Unsupported Node version:** use Node 24 LTS or a version in the supported range above.
- **Port occupied:** stop the earlier server or use `PORT=5174 bash run_app.sh`.
- **Launcher missing:** change into the project directory.
- **Bash line-ending error:** save the launcher with LF endings; `.gitattributes` specifies them.
- **Data validation error:** restore the original CSV and run `npm run check:data`. Malformed records are rejected rather than replaced with invented values.

## Assignment workflow

The student uses the running Stage 2 app to check the display, records decisions and evidence in `DECISIONS.md`, and confirms later design choices before implementation. Stage 2 does not run the later investigations.

Python/Streamlit files are retained as legacy source. Python is not needed by the new launcher.
