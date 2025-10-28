#!/bin/bash

echo "🧹 Cleaning up build directories..."

# Try to remove directories with different permission approaches
if [ -d "out" ]; then
    echo "Removing out directory..."
    chmod -R 755 out 2>/dev/null || true
    rm -rf out 2>/dev/null || true
fi

if [ -d ".next" ]; then
    echo "Removing .next directory..."
    chmod -R 755 .next 2>/dev/null || true
    rm -rf .next 2>/dev/null || true
fi

# Create fresh directories
mkdir -p out
mkdir -p .next

echo "✅ Cleanup completed!"
