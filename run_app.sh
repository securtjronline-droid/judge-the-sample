#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
. .venv/bin/activate
python -m pip install -q -r requirements.txt
echo 'Open http://localhost:8501 in your browser. Press Ctrl+C to stop.'
exec python -m streamlit run app.py --server.address localhost --server.port 8501
