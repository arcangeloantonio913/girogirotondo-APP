#!/usr/bin/env bash
# Avvio del backend. Espone libstdc++ del toolchain Nix a pillow-heif: senza, il binario
# nativo _pillow_heif non trova libstdc++.so.6 (Python Nix isolato) e register_heif_opener
# fallisce -> le foto HEIC (iPhone) NON vengono convertite in JPEG all'upload.
# Glob dinamico: l'hash nello store Nix può cambiare tra una build e l'altra.
LIB="$(ls -d /nix/store/*-gcc-*-lib/lib/libstdc++.so.6 2>/dev/null | head -1)"
if [ -n "$LIB" ]; then
  export LD_LIBRARY_PATH="$(dirname "$LIB"):${LD_LIBRARY_PATH}"
fi

export OPENSSL_CONF=./openssl.cnf
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
