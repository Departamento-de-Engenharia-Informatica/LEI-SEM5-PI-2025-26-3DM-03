#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 --type <full|incremental|monthly> --out <output_dir>"; }

TYPE=""
OUT="backup_out"
DB_TYPE="${DB_TYPE:-postgres}"
DB_CONNECTION="${DB_CONNECTION:-}"
HOSTNAME_FQDN=$(hostname)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type) TYPE="$2"; shift 2;;
    --out) OUT="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

if [[ -z "$TYPE" ]]; then echo "--type is required"; exit 2; fi
mkdir -p "$OUT"

TS_DATE=$(date -u +%Y%m%d)
TS_FULL=$(date -u +%Y%m%d-%H%M)

manifest() {
  local kind="$1"; local file="$2"; local sha="$3"
  cat >"$OUT/manifest-${TS_FULL}.json" <<JSON
{
  "kind": "$kind",
  "timestamp_utc": "${TS_FULL}",
  "host": "${HOSTNAME_FQDN}",
  "db_type": "${DB_TYPE}",
  "file": "$(basename "$file")",
  "sha256": "${sha}"
}
JSON
}

if [[ -z "${DB_CONNECTION}" ]]; then
  if [[ "$DB_TYPE" == "sqlite" ]]; then
    # allow implicit default if a repo-local SQLite file exists
    if [[ -f "port.db" ]]; then
      DB_CONNECTION="port.db"
    elif [[ -f "TodoApi/port.db" ]]; then
      DB_CONNECTION="TodoApi/port.db"
    else
      echo "DB_CONNECTION is required (SQLite file path or 'Data Source=...')"
      exit 4
    fi
  else
    echo "DB_CONNECTION is required (e.g., postgres://user:pass@host:5432/dbname)"
    exit 4
  fi
fi

if [[ "$DB_TYPE" != "postgres" && "$DB_TYPE" != "sqlite" ]]; then
  echo "Unsupported DB_TYPE '$DB_TYPE'. Supported: postgres, sqlite"
  exit 3
fi

case "$TYPE" in
  full)
    if [[ "$DB_TYPE" == "sqlite" ]]; then
      OUTFILE="$OUT/db-full-${TS_DATE}.sqlite.gz"
    else
      OUTFILE="$OUT/db-full-${TS_DATE}.dump.gz"
    fi ;;
  incremental)
    if [[ "$DB_TYPE" == "sqlite" ]]; then
      OUTFILE="$OUT/db-inc-${TS_FULL}.sqlite.gz"
    else
      OUTFILE="$OUT/db-inc-${TS_FULL}.dump.gz"
    fi ;;
  monthly)
    if [[ "$DB_TYPE" == "sqlite" ]]; then
      OUTFILE="$OUT/db-monthly-${TS_DATE}.sqlite.gz"
    else
      OUTFILE="$OUT/db-monthly-${TS_DATE}.dump.gz"
    fi ;;
  *) echo "Invalid type $TYPE"; exit 5;;
 esac

if [[ "$DB_TYPE" == "postgres" ]]; then
  # Logical snapshot via pg_dump (keeps RPO with frequent runs; simple restore)
  TMPDUMP=$(mktemp /tmp/dbdump.XXXXXX)
  pg_dump -Fc -d "$DB_CONNECTION" -f "$TMPDUMP"
  GZ=$(mktemp /tmp/dbdumpgz.XXXXXX)
  gzip -c "$TMPDUMP" > "$GZ"
  rm -f "$TMPDUMP"
  mv "$GZ" "$OUTFILE"
else
  # SQLite backup: create a consistent snapshot then gzip
  # Accept either plain file path or 'Data Source=...' style connection string
  DB_FILE="$DB_CONNECTION"
  if [[ "$DB_FILE" == Data\ Source=* ]]; then
    DB_FILE=${DB_FILE#Data Source=}
  fi
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 not found; please install sqlite3 in your environment" >&2
    exit 6
  fi
  TMPDB=$(mktemp /tmp/sqlite.XXXXXX)
  # Use .backup (works even if DB is in use, when possible)
  sqlite3 "$DB_FILE" ".backup '$TMPDB'" 2>/dev/null || cp -f "$DB_FILE" "$TMPDB"
  GZ=$(mktemp /tmp/dbgz.XXXXXX)
  gzip -c "$TMPDB" > "$GZ"
  rm -f "$TMPDB"
  mv "$GZ" "$OUTFILE"
fi

# checksum
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUTFILE" | awk '{print $1}' > "${OUTFILE}.sha256"
else
  # macOS fallback
  shasum -a 256 "$OUTFILE" | awk '{print $1}' > "${OUTFILE}.sha256"
fi
SHA=$(cat "${OUTFILE}.sha256")
manifest "$TYPE" "$OUTFILE" "$SHA"

echo "Backup created: $OUTFILE"
