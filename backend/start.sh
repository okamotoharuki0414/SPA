#!/bin/sh

echo "🚀 Starting SPA Backend Services..."

# Start the API server in the background
echo "📡 Starting API Server on port 3001..."
node dist/server.js &

# Give API server time to start
sleep 2

# Start the SSE server in the foreground
echo "📺 Starting SSE Server on port 3002..."
node dist/sse-server.js