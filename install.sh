#!/usr/bin/env bash
# =============================================================================
#  Swarna Deepika - One-Click Cross-Platform Installer (Linux / macOS / EC2)
#
#  What this script does:
#    1. Detects your OS + package manager (apt, dnf/yum, apk, brew).
#    2. Installs missing prerequisites: python3, node, yarn, mongodb.
#    3. Creates backend/.env and frontend/.env from the committed .env.example
#       files if they don't exist yet.
#    4. Installs Python + Node dependencies.
#    5. Starts MongoDB, backend (uvicorn on :8001) and frontend build served
#       via a simple static server (or `yarn start` in dev mode).
#
#  Two modes:
#    ./install.sh           -> installs + runs in DEV mode (yarn start on :3000)
#    ./install.sh --prod    -> installs + builds frontend + runs as a
#                             single web app on the same port as the backend
#    ./install.sh --setup   -> only install/setup, do not start services
#
#  On an EC2 / server you probably want:  sudo ./install.sh --prod
# =============================================================================
set -euo pipefail

MODE="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

log()  { printf "\033[1;32m==> %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m--> %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m!!  %s\033[0m\n" "$*" >&2; }

need_sudo() {
  if [ "$(id -u)" -ne 0 ]; then echo "sudo"; else echo ""; fi
}
SUDO="$(need_sudo)"

# ---------- Detect package manager ----------
detect_pkg() {
  if   command -v apt-get >/dev/null 2>&1; then echo "apt"
  elif command -v dnf     >/dev/null 2>&1; then echo "dnf"
  elif command -v yum     >/dev/null 2>&1; then echo "yum"
  elif command -v apk     >/dev/null 2>&1; then echo "apk"
  elif command -v brew    >/dev/null 2>&1; then echo "brew"
  else echo "unknown"; fi
}
PKG="$(detect_pkg)"
log "OS: $(uname -s)  Package manager: ${PKG}"

pkg_install() {
  case "$PKG" in
    apt)  $SUDO apt-get install -y "$@" ;;
    dnf)  $SUDO dnf install -y "$@" ;;
    yum)  $SUDO yum install -y "$@" ;;
    apk)  $SUDO apk add --no-cache "$@" ;;
    brew) brew install "$@" ;;
    *)    err "No supported package manager. Please install $* manually."; exit 1 ;;
  esac
}
pkg_update() {
  case "$PKG" in
    apt) $SUDO apt-get update -y ;;
    dnf|yum) $SUDO $PKG makecache -y || true ;;
    apk) $SUDO apk update ;;
    brew) brew update ;;
  esac
}

# ---------- Ensure prerequisites ----------
have() { command -v "$1" >/dev/null 2>&1; }

install_python() {
  if have python3 && python3 -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)"; then
    log "Python 3.10+ present: $(python3 --version)"
  else
    log "Installing Python 3..."
    pkg_update
    case "$PKG" in
      apt)  pkg_install python3 python3-venv python3-pip ;;
      dnf|yum) pkg_install python3 python3-pip ;;
      apk)  pkg_install python3 py3-pip ;;
      brew) pkg_install python ;;
    esac
  fi
}

install_node() {
  if have node && node -e 'process.exit(parseInt(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
    log "Node.js present: $(node --version)"
  else
    log "Installing Node.js LTS..."
    case "$PKG" in
      apt)
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
        pkg_install nodejs ;;
      dnf|yum)
        curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO -E bash -
        pkg_install nodejs ;;
      apk)  pkg_install nodejs npm ;;
      brew) pkg_install node ;;
    esac
  fi
}

install_yarn() {
  if have yarn; then log "Yarn present: $(yarn --version)"; return; fi
  log "Installing Yarn..."
  $SUDO npm install -g yarn
}

install_mongo() {
  if have mongod; then log "MongoDB present: $(mongod --version | head -1)"; return; fi
  log "Installing MongoDB..."
  case "$PKG" in
    apt)
      # Ubuntu/Debian: add MongoDB 7 repo
      pkg_install curl gnupg
      curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
        $SUDO gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
      CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME" || echo "jammy")"
      echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" \
        | $SUDO tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null
      $SUDO apt-get update -y
      pkg_install mongodb-org
      ;;
    dnf|yum)
      $SUDO tee /etc/yum.repos.d/mongodb-org-7.0.repo > /dev/null <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
      pkg_install mongodb-org
      ;;
    apk)
      warn "Alpine does not ship MongoDB; please use Docker MongoDB or switch to Debian/Ubuntu."
      ;;
    brew)
      brew tap mongodb/brew || true
      brew install mongodb-community@7.0
      ;;
  esac
}

start_mongo() {
  if ! have mongod; then return; fi
  if pgrep -x mongod >/dev/null; then log "MongoDB is already running"; return; fi
  log "Starting MongoDB..."
  case "$PKG" in
    apt|dnf|yum) $SUDO systemctl enable mongod && $SUDO systemctl start mongod ;;
    brew)        brew services start mongodb-community@7.0 || mongod --config /usr/local/etc/mongod.conf --fork ;;
    apk)         $SUDO mkdir -p /data/db && $SUDO mongod --fork --logpath /var/log/mongod.log --dbpath /data/db ;;
  esac
}

install_python
install_node
install_yarn
install_mongo

# ---------- .env from templates ----------
if [ ! -f backend/.env ] && [ -f backend/.env.example ]; then
  cp backend/.env.example backend/.env
  log "Created backend/.env from template"
fi
if [ ! -f frontend/.env ] && [ -f frontend/.env.example ]; then
  cp frontend/.env.example frontend/.env
  log "Created frontend/.env from template"
fi

# ---------- Backend deps ----------
log "Installing backend Python deps..."
if [ ! -d backend/venv ]; then
  python3 -m venv backend/venv
fi
# shellcheck disable=SC1091
source backend/venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
deactivate

# ---------- Frontend deps ----------
log "Installing frontend deps..."
(cd frontend && yarn install)

# ---------- Start MongoDB ----------
start_mongo
sleep 2

if [ "$MODE" = "--setup" ] || [ "$MODE" = "setup" ]; then
  log "Setup complete. Not starting services (--setup)."
  exit 0
fi

# ---------- Run! ----------
mkdir -p logs
BACKEND_LOG="$SCRIPT_DIR/logs/backend.log"
FRONTEND_LOG="$SCRIPT_DIR/logs/frontend.log"

if [ "$MODE" = "--prod" ] || [ "$MODE" = "prod" ]; then
  log "Building frontend for production..."
  # In prod we want the UI to call the backend on the same origin.
  ( cd frontend && REACT_APP_BACKEND_URL="" yarn build )
  log "Frontend built to frontend/build. Starting backend on 0.0.0.0:8001 ..."
  # In prod we also serve the built frontend at /  via a tiny helper.
  # But the simplest reliable path: use nginx OR just run the desktop-style
  # single-port SQLite backend if the user wants zero-config. For now we
  # expose the FastAPI (MongoDB) backend on 8001 and the built UI on 3000
  # via `serve`.
  if ! have serve; then
    $SUDO npm install -g serve
  fi
  ( cd backend && source venv/bin/activate && \
    nohup uvicorn server:app --host 0.0.0.0 --port 8001 > "$BACKEND_LOG" 2>&1 & echo $! > "$SCRIPT_DIR/logs/backend.pid" )
  ( cd frontend && nohup serve -s build -l 3000 > "$FRONTEND_LOG" 2>&1 & echo $! > "$SCRIPT_DIR/logs/frontend.pid" )
  sleep 2
  log "=========================================================="
  log "  Swarna Deepika is running:"
  log "    Web UI  :  http://$(hostname -I 2>/dev/null | awk '{print $1}'):3000"
  log "    Backend :  http://$(hostname -I 2>/dev/null | awk '{print $1}'):8001/api"
  log "    Login   :  admin / swarna123"
  log "    Logs    :  $BACKEND_LOG   /   $FRONTEND_LOG"
  log "  Stop with:  bash stop.sh"
  log "=========================================================="
else
  # DEV mode
  ( cd backend && source venv/bin/activate && \
    nohup uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$BACKEND_LOG" 2>&1 & echo $! > "$SCRIPT_DIR/logs/backend.pid" )
  ( cd frontend && nohup env HOST=0.0.0.0 PORT=3000 yarn start > "$FRONTEND_LOG" 2>&1 & echo $! > "$SCRIPT_DIR/logs/frontend.pid" )
  sleep 3
  log "=========================================================="
  log "  DEV mode running:"
  log "    Frontend:  http://localhost:3000"
  log "    Backend :  http://localhost:8001/api"
  log "    Login   :  admin / swarna123"
  log "    Logs    :  $BACKEND_LOG   /   $FRONTEND_LOG"
  log "  Stop with:  bash stop.sh"
  log "=========================================================="
fi
