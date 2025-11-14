#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 --file <dump.gz> --target <connection_string>"; }

FILE=""
TARGET=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2;;
    --target) TARGET="$2"; shift 2;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

if [[ -z "$FILE" || -z "$TARGET" ]]; then usage; exit 2; fi

TMP=$(mktemp /tmp/restore.XXXXXX)
if [[ "$FILE" == *.gz ]]; then
  gunzip -c "$FILE" > "$TMP"
else
  cp "$FILE" "$TMP"
fi

pg_restore -d "$TARGET" -v "$TMP"
rm -f "$TMP"

echo "Restore done into $TARGET"
