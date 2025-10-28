#!/usr/bin/env bash
# docker_bootstrap.sh
# forumapp/ 直下で:  chmod +x docker_bootstrap.sh && ./docker_bootstrap.sh

set -Eeuo pipefail

# ===== 共通 =====
RAILS_DIR="services/rails_api"
SPRING_DIR="services/spring_api"
EXPRESS_DIR="services/express_api"
FRONTEND_DIR="frontend"
UIDGID="$(id -u):$(id -g)"
ROOT="$(pwd)"

log() { printf "\033[1;36m==> %s\033[0m\n" "$*"; }
die() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; exit 1; }
on_err() { die "途中で失敗しました。上のログ末尾を確認してください。"; }
trap on_err ERR

command -v docker >/dev/null || die "Docker が見つかりません。Docker Desktop を起動してください。"

umask 022
mkdir -p "$RAILS_DIR" "$SPRING_DIR" "$EXPRESS_DIR" "$FRONTEND_DIR"

log "PWD: $ROOT"
log "UID:GID = $UIDGID"

# ===== Rails =====
if [ -f "$RAILS_DIR/Gemfile" ] || [ -d "$RAILS_DIR/.git" ]; then
  log "Rails: $RAILS_DIR は既に存在 → スキップ"
else
  log "Rails: rails_api を生成"
  # rails 実行PATHは /usr/local/bundle/bin をフルパスで指定
  docker run --rm -u "$UIDGID" \
    -v "$ROOT/services:/work" -w /work ruby:3.3 \
    bash -lc 'gem install -N rails && /usr/local/bundle/bin/rails new rails_api --api -T -d postgresql'
fi

# ===== Spring Boot =====
if [ -f "$SPRING_DIR/build.gradle" ] || [ -f "$SPRING_DIR/settings.gradle" ]; then
  log "Spring: $SPRING_DIR は既に存在 → スキップ"
else
  log "Spring: spring_api をダウンロード & 展開（安定モード）"
  # 既存の中身を安全に掃除（zsh のグロブ確認を避ける）
  rm -rf "$SPRING_DIR"/* 2>/dev/null || true

  # curl 専用イメージで ZIP 取得（bootVersion/javaVersion は固定しない）
  docker run --rm -u "$UIDGID" \
    -v "$ROOT/$SPRING_DIR:/work" curlimages/curl:8.8.0 \
    -fL --retry 5 --retry-delay 2 --connect-timeout 15 \
    "https://start.spring.io/starter.zip?type=gradle-project&language=java&baseDir=spring_api&name=spring-api&groupId=app.forum&artifactId=spring-api&packageName=app.forum&dependencies=web" \
    -o /work/spring.zip

  # busybox で検査・展開・ドットファイルごと移動
  docker run --rm -u "$UIDGID" \
    -v "$ROOT/$SPRING_DIR:/work" busybox \
    sh -lc 'unzip -t /work/spring.zip >/dev/null && unzip /work/spring.zip -d /work >/dev/null && rm /work/spring.zip && cp -a /work/spring_api/. /work/ && rm -rf /work/spring_api'
fi

# --- Express ---
if [ -f "$EXPRESS_DIR/package.json" ]; then
  log "Express: $EXPRESS_DIR は既に存在 → スキップ"
else
  log "Express: express_api を生成"
  # 既存を完全削除（ドットファイル含む）
  find "$EXPRESS_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true

  # 1) generator は /tmp をHOME/キャッシュにして実行（/appにゴミを作らない）
  docker run --rm -u "$UIDGID" \
    -e HOME=/tmp -e NPM_CONFIG_CACHE=/tmp/.npm \
    -v "$ROOT/$EXPRESS_DIR:/app" -w /app node:20 \
    bash -lc 'npx -y express-generator --no-view .'

  # 2) 依存インストール時のみ /app 側にキャッシュ作成
  docker run --rm -u "$UIDGID" \
    -e HOME=/app -e NPM_CONFIG_CACHE=/app/.npm \
    -v "$ROOT/$EXPRESS_DIR:/app" -w /app node:20 \
    bash -lc 'mkdir -p "$NPM_CONFIG_CACHE" && npm install --no-fund --no-audit'
fi

# --- Frontend (Vite + TS) ---
if [ -f "$FRONTEND_DIR/package.json" ]; then
  log "Frontend: $FRONTEND_DIR は既に存在 → スキップ"
else
  log "Frontend: Vite + React + TS を生成"
  # 既存を完全削除（ドットファイル含む）
  find "$FRONTEND_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true

  # 1) scaffold は /tmp HOME で（/appにゴミ不要）
  docker run --rm -u "$UIDGID" \
    -e HOME=/tmp -e NPM_CONFIG_CACHE=/tmp/.npm \
    -v "$ROOT/$FRONTEND_DIR:/app" -w /app node:20 \
    bash -lc 'npx -y create-vite@latest . -- --template react-ts'

  # 2) 依存インストールは /app HOME
  docker run --rm -u "$UIDGID" \
    -e HOME=/app -e NPM_CONFIG_CACHE=/app/.npm \
    -v "$ROOT/$FRONTEND_DIR:/app" -w /app node:20 \
    bash -lc 'mkdir -p "$NPM_CONFIG_CACHE" && npm install --no-fund --no-audit'
fi


log "Done."
# tree がなければ find で代替
if command -v tree >/dev/null 2>&1; then
  tree -L 2 .
else
  find . -maxdepth 2 -print
fi
