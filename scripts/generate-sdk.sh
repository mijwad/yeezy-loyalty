#!/usr/bin/env bash
set -e

echo "Generating @yourbrand/loyalty-sdk..."
node --experimental-strip-types scripts/generate-sdk.ts
echo "Done!"
