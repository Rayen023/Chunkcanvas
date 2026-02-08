#!/bin/bash

# Configuration
DEST_DIR="/mnt/0a56cc8f-eb63-4f04-b727-0615646b8bdb/vllm"
URL="$1"

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

if [[ -z "$URL" ]]; then
    echo "Usage: $0 <huggingface_url>"
    echo "Example (Repo): $0 https://huggingface.co/unsloth/Qwen3-0.6B-GGUF"
    echo "Example (File): $0 https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q3_K_M.gguf?download=true"
    exit 1
fi

# Function to download via wget
download_file() {
    local download_url="$1"
    local filename="$2"
    local target_path="$DEST_DIR/$filename"
    
    echo "Downloading to $target_path..." >&2
    wget -q --show-progress -O "$target_path" "$download_url"
    
    if [[ $? -eq 0 ]]; then
        echo "$target_path"
    else
        echo "Error downloading file." >&2
        exit 1
    fi
}

# Check if it's a direct resolve link or a repo link
if [[ "$URL" == *"resolve"* ]]; then
    # Direct link: extract filename (strip query params like ?download=true)
    FILENAME=$(basename "${URL%%\?*}")
    download_file "$URL" "$FILENAME"
else
    # Repo link: Try to use huggingface-cli if available
    REPO_ID=$(echo "$URL" | sed -E 's|https?://huggingface.co/([^/]+/[^/]+).*|\1|')
    
    if command -v huggingface-cli &> /dev/null; then
        echo "Using huggingface-cli to download GGUF from $REPO_ID..." >&2
        # Download and get the path. vllm usually needs the file path for GGUF.
        # We ensure we get the actual file path.
        RELATIVE_PATH=$(huggingface-cli download "$REPO_ID" --include "*.gguf" --local-dir "$DEST_DIR" --local-dir-use-symlinks False 2>&1 | grep -o "$DEST_DIR/.*\.gguf" | head -n 1)
        
        if [[ -n "$RELATIVE_PATH" ]]; then
            echo "$RELATIVE_PATH"
        else
            # Search for the GGUF file in the destination directory as a backup
            find "$DEST_DIR" -maxdepth 1 -name "*.gguf" -printf '%T@ %p
' | sort -n | tail -1 | cut -f2- -d" "
        fi
    else
        echo "huggingface-cli not found. Please provide a direct resolve link or install 'huggingface-hub'." >&2
        exit 1
    fi
fi
