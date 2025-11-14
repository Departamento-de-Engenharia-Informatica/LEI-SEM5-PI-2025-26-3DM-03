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

if [[ "$DB_TYPE" != "postgres" ]]; then
  echo "Only postgres implemented in script now. Set DB_TYPE=postgres"
  exit 3
fi

if [[ -z "${DB_CONNECTION}" ]]; then
  echo "DB_CONNECTION is required (e.g., postgres://user:pass@host:5432/dbname)"
  exit 4
fi

case "$TYPE" in
  full)
    OUTFILE="$OUT/db-full-${TS_DATE}.dump.gz" ;;
  incremental)
    OUTFILE="$OUT/db-inc-${TS_FULL}.dump.gz" ;;
  monthly)
    OUTFILE="$OUT/db-monthly-${TS_DATE}.dump.gz" ;;
  *) echo "Invalid type $TYPE"; exit 5;;
 esac

# Logical snapshot via pg_dump (keeps RPO with frequent runs; simple restore)
TMPDUMP=$(mktemp /tmp/dbdump.XXXXXX)
pg_dump -Fc -d "$DB_CONNECTION" -f "$TMPDUMP"
GZ=$(mktemp /tmp/dbdumpgz.XXXXXX)
gzip -c "$TMPDUMP" > "$GZ"
rm -f "$TMPDUMP"

mv "$GZ" "$OUTFILE"

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
