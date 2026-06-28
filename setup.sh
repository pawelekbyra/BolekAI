#!/usr/bin/env bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${CYAN}[BOLEK]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
die()     { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║       AGENT BOLEK  SETUP         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""

command -v wrangler >/dev/null 2>&1 || die "wrangler nie znaleziony. Uruchom: npm install"
command -v node     >/dev/null 2>&1 || die "node nie znaleziony"

# ── 1. Zaloguj się do Cloudflare ─────────────────────────────────────────────
info "Sprawdzam login Cloudflare..."
wrangler whoami >/dev/null 2>&1 || {
  warn "Nie zalogowany. Loguję..."
  wrangler login
}
success "Cloudflare OK"

# ── 2. D1 Database ───────────────────────────────────────────────────────────
info "Tworzę bazę D1 'bolek-memory'..."
D1_OUTPUT=$(wrangler d1 create bolek-memory 2>&1 || true)

if echo "$D1_OUTPUT" | grep -q "database_id"; then
  D1_ID=$(echo "$D1_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)".*/\1/')
elif echo "$D1_OUTPUT" | grep -q "already exists"; then
  warn "Baza już istnieje — pobieram ID..."
  D1_ID=$(wrangler d1 list --json 2>/dev/null | node -e "
    const data = require('fs').readFileSync('/dev/stdin','utf8');
    const list = JSON.parse(data);
    const db = list.find(d => d.name === 'bolek-memory');
    console.log(db ? db.uuid : '');
  ")
else
  die "Nie udało się stworzyć D1. Output: $D1_OUTPUT"
fi

[ -z "$D1_ID" ] && die "Nie udało się pobrać D1 ID"
success "D1 ID: $D1_ID"

# ── 3. KV Namespace ───────────────────────────────────────────────────────────
info "Tworzę KV namespace 'bolek-kv'..."
KV_OUTPUT=$(wrangler kv namespace create bolek-kv 2>&1 || true)

if echo "$KV_OUTPUT" | grep -q '"id"'; then
  KV_ID=$(echo "$KV_OUTPUT" | grep '"id"' | sed 's/.*"id": "\(.*\)".*/\1/' | head -1)
elif echo "$KV_OUTPUT" | grep -q "already exists"; then
  warn "KV już istnieje — pobieram ID..."
  KV_ID=$(wrangler kv namespace list --json 2>/dev/null | node -e "
    const data = require('fs').readFileSync('/dev/stdin','utf8');
    const list = JSON.parse(data);
    const ns = list.find(n => n.title === 'agent-bolek-bolek-kv');
    console.log(ns ? ns.id : '');
  ")
fi

[ -z "$KV_ID" ] && die "Nie udało się pobrać KV ID"
success "KV ID: $KV_ID"

# ── 4. Zaktualizuj wrangler.toml ─────────────────────────────────────────────
info "Aktualizuję wrangler.toml..."
sed -i "s/REPLACE_WITH_YOUR_D1_ID/$D1_ID/" wrangler.toml
sed -i "s/REPLACE_WITH_YOUR_KV_ID/$KV_ID/" wrangler.toml
success "wrangler.toml zaktualizowany"

# ── 5. Migracja bazy ──────────────────────────────────────────────────────────
info "Aplikuję migracje D1..."
npm run db:migrate:remote
success "Baza gotowa"

# ── 6. Telegram Bot Token ─────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Idź do Telegrama → @BotFather → /newbot${NC}"
echo -e "${YELLOW}Nazwij bota 'Bolek' i skopiuj token.${NC}"
echo ""
read -rp "Wklej TELEGRAM_BOT_TOKEN: " BOT_TOKEN
[ -z "$BOT_TOKEN" ] && die "Token nie może być pusty"

wrangler secret put TELEGRAM_BOT_TOKEN <<< "$BOT_TOKEN"
success "Token zapisany"

# ── 7. Webhook Secret ────────────────────────────────────────────────────────
WEBHOOK_SECRET=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
wrangler secret put TELEGRAM_WEBHOOK_SECRET <<< "$WEBHOOK_SECRET"
success "Webhook secret: $WEBHOOK_SECRET"

# ── 8. Deploy ─────────────────────────────────────────────────────────────────
info "Deploying AGENT BOLEK..."
DEPLOY_OUTPUT=$(npm run deploy 2>&1)
echo "$DEPLOY_OUTPUT"

WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://agent-bolek\.[^[:space:]]*' | head -1)
[ -z "$WORKER_URL" ] && die "Nie udało się pobrać URL workera z output deploy"
success "Worker URL: $WORKER_URL"

# ── 9. Ustaw webhook Telegram ────────────────────────────────────────────────
info "Ustawiam webhook Telegram..."
WEBHOOK_URL="${WORKER_URL}/webhook/${WEBHOOK_SECRET}"

RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "allowed_updates=[\"message\"]")

echo "$RESPONSE" | grep -q '"ok":true' \
  && success "Webhook ustawiony: $WEBHOOK_URL" \
  || die "Webhook error: $RESPONSE"

# ── Gotowe ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════╗${NC}"
echo -e "${GREEN}║     AGENT BOLEK DZIAŁA!          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════╝${NC}"
echo ""
echo -e "  Worker:  ${CYAN}$WORKER_URL${NC}"
echo -e "  Webhook: ${CYAN}$WEBHOOK_URL${NC}"
echo ""
echo -e "  Napisz do swojego bota na Telegramie — Bolek odpowie."
echo ""
