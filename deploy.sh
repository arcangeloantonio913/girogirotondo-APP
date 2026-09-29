#!/usr/bin/env bash
# Deploy affidabile di Girogirotondo — un solo comando.
# Uso:  bash deploy.sh            (tutto: backend + entrambi i web)
#       bash deploy.sh backend    (solo backend Railway)
#       bash deploy.sh web        (solo i 2 web app Vercel, build pulita)
#
# Perché esiste: i deploy manuali si rompevano per (1) il prefisso ! su più righe,
# (2) la build-cache Vercel che ricompilava codice vecchio. Qui è tutto gestito.
set -euo pipefail
ROOT="$HOME/Documents/OMNIA/girogirotondo/girogirotondo-APP"
FRONT="$ROOT/frontend"
TARGET="${1:-all}"

deploy_backend() {
  echo "▶ BACKEND (Railway)…"
  cd "$ROOT"
  railway up -s girogirotondo-APP
  echo "✅ Backend deployato."
}

deploy_web() {
  cd "$FRONT"
  echo "▶ WEB girogirotondo (build pulita, no cache)…"
  vercel link --yes --project girogirotondo >/dev/null
  VERCEL_FORCE_NO_BUILD_CACHE=1 vercel --prod --force
  echo "▶ WEB dimensionebimbo (build pulita, no cache)…"
  vercel link --yes --project dimensionebimbowebapp >/dev/null
  VERCEL_FORCE_NO_BUILD_CACHE=1 vercel --prod --force
  # ripristina il link al progetto principale
  vercel link --yes --project dimensionebimbowebapp >/dev/null
  echo "✅ Web deployati (entrambi i tenant)."
}

case "$TARGET" in
  backend) deploy_backend ;;
  web)     deploy_web ;;
  all)     deploy_backend; deploy_web ;;
  *) echo "Uso: bash deploy.sh [all|backend|web]"; exit 1 ;;
esac
echo "🎉 Fatto."
