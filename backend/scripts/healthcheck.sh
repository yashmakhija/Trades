#!/bin/sh
curl -f http://localhost:${PORT:-3001}/health || exit 1 