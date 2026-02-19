#!/bin/bash

# launch-teams-debug.sh - Helper script to launch Microsoft Teams with debugging

set -e

TEAMS_APP_PATH="/Applications/Microsoft Teams.app/Contents/MacOS/MSTeams"
DEBUG_PORT=9222
TIMEOUT=30

echo "🔄 Launching Microsoft Teams with debugging support..."

# Function to check if Teams is already running with debugging
check_debug_port() {
    lsof -i :$DEBUG_PORT >/dev/null 2>&1
}

# Function to kill existing Teams processes
kill_teams() {
    echo "🛑 Killing existing Teams processes..."
    pkill -f "MSTeams" 2>/dev/null || true
    sleep 2
}

# Function to wait for debug port to be available
wait_for_debug_port() {
    local count=0
    echo "⏳ Waiting for debug port $DEBUG_PORT to be ready..."

    while [ $count -lt $TIMEOUT ]; do
        if check_debug_port; then
            echo "✅ Debug port is ready!"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        if [ $((count % 5)) -eq 0 ]; then
            echo "   Still waiting... ($count/${TIMEOUT}s)"
        fi
    done

    echo "❌ Timeout waiting for debug port"
    return 1
}

# Function to launch Teams with debug flags
launch_teams() {
    echo "🚀 Starting Teams with debugging flags..."

    "$TEAMS_APP_PATH" \
        --remote-debugging-port=$DEBUG_PORT \
        --enable-logging \
        --disable-background-timer-throttling \
        --disable-backgrounding-occluded-windows \
        --disable-renderer-backgrounding \
        --no-first-run \
        --disable-default-apps \
        > /dev/null 2>&1 &

    local teams_pid=$!
    echo "📱 Teams launched with PID: $teams_pid"

    # Store PID for cleanup
    echo $teams_pid > .teams_debug_pid

    return 0
}

# Function to cleanup on exit
cleanup() {
    if [ -f .teams_debug_pid ]; then
        local pid=$(cat .teams_debug_pid)
        if kill -0 "$pid" 2>/dev/null; then
            echo "🧹 Cleaning up Teams process (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
        fi
        rm -f .teams_debug_pid
    fi
}

# Set up signal handlers for cleanup
trap cleanup EXIT INT TERM

# Main execution
main() {
    # Check if Teams debugging is already running
    if check_debug_port; then
        echo "✅ Teams debugging is already running on port $DEBUG_PORT"
        return 0
    fi

    # Kill any existing Teams processes
    kill_teams

    # Launch Teams with debugging
    launch_teams

    # Wait for debug port to be ready
    if wait_for_debug_port; then
        echo "🎉 Teams is ready for debugging!"
        echo "🔗 WebSocket available at: ws://127.0.0.1:$DEBUG_PORT"

        # If run with --wait flag, keep running
        if [ "$1" = "--wait" ]; then
            echo "⏸️  Press Ctrl+C to stop Teams and exit..."
            while true; do
                if ! check_debug_port; then
                    echo "❌ Debug port is no longer available"
                    break
                fi
                sleep 5
            done
        fi

        return 0
    else
        echo "❌ Failed to start Teams with debugging"
        cleanup
        return 1
    fi
}

# Help text
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [--wait]"
    echo
    echo "Launch Microsoft Teams with remote debugging enabled"
    echo
    echo "Options:"
    echo "  --wait    Keep the script running until Ctrl+C"
    echo "  -h, --help Show this help message"
    echo
    echo "The script will:"
    echo "  1. Kill any existing Teams processes"
    echo "  2. Launch Teams with debugging on port $DEBUG_PORT"
    echo "  3. Wait for the debug port to become available"
    echo "  4. Exit (unless --wait is specified)"
    exit 0
fi

# Run main function
main "$@"