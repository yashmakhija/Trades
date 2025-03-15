#!/bin/bash

# Cleanup script for documentation files
# This script removes old documentation files that have been moved to the new structure

echo "Cleaning up old documentation files..."

# Check if files exist before removing them
if [ -f "README-candle-data.md" ]; then
  echo "Removing README-candle-data.md (moved to docs/features/candle-data.md)"
  rm README-candle-data.md
fi

if [ -f "API_DOCUMENTATION.md" ]; then
  echo "Removing API_DOCUMENTATION.md (moved to docs/api/README.md)"
  rm API_DOCUMENTATION.md
fi

if [ -f "SUMMARY.md" ]; then
  echo "Removing SUMMARY.md (moved to docs/timescaledb/SUMMARY.md)"
  rm SUMMARY.md
fi

if [ -f "FINAL-SUMMARY.md" ]; then
  echo "Removing FINAL-SUMMARY.md (moved to docs/timescaledb/FINAL-SUMMARY.md)"
  rm FINAL-SUMMARY.md
fi

echo "Cleanup complete!"
echo "Documentation is now organized in the docs/ directory:"
echo "- docs/api/README.md: API documentation"
echo "- docs/features/candle-data.md: Candle data system documentation"
echo "- docs/timescaledb/: TimescaleDB documentation" 