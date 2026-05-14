#!/usr/bin/env python3
"""Generate images using a reference photo with OpenAI gpt-image-1 image edit endpoint.

Takes an input image as a reference and generates a new image based on a prompt.
Useful for creating cartoon versions of real photos while preserving likeness.
"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.request
from pathlib import Path


def edit_image(prompt, input_paths, output_path, api_key, size="1024x1024", transparent=True):
    """Call OpenAI image edit endpoint with reference photo(s)."""
    url = "https://api.openai.com/v1/images/edits"

    # Build multipart/form-data manually (no requests dependency)
    boundary = "----banana" + os.urandom(8).hex()
    body_parts = []

    def add_field(name, value):
        body_parts.append(f"--{boundary}\r\n".encode())
        body_parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body_parts.append(f"{value}\r\n".encode())

    def add_file(name, path):
        mime, _ = mimetypes.guess_type(str(path))
        mime = mime or "image/png"
        filename = Path(path).name
        with open(path, "rb") as f:
            data = f.read()
        body_parts.append(f"--{boundary}\r\n".encode())
        body_parts.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        )
        body_parts.append(f"Content-Type: {mime}\r\n\r\n".encode())
        body_parts.append(data)
        body_parts.append(b"\r\n")

    add_field("model", "gpt-image-1")
    add_field("prompt", prompt)
    add_field("size", size)
    add_field("n", "1")
    add_field("quality", "high")
    if transparent:
        add_field("background", "transparent")

    # Multiple images supported via image[] field
    for p in input_paths:
        add_file("image[]", p)

    body_parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(body_parts)

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
            b64 = data["data"][0]["b64_json"]
            img_bytes = base64.b64decode(b64)
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(img_bytes)
            print(json.dumps({"success": True, "path": str(output_path), "size": len(img_bytes)}))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(json.dumps({"success": False, "status": e.code, "error": error_body}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--input", required=True, action="append",
                        help="Reference image path (can be repeated for multiple references)")
    parser.add_argument("--output", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--size", default="1024x1024")
    parser.add_argument("--no-transparent", action="store_true")
    args = parser.parse_args()
    edit_image(args.prompt, args.input, args.output, args.api_key, args.size, not args.no_transparent)
