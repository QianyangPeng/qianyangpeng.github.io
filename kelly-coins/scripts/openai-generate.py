#!/usr/bin/env python3
"""Generate images with OpenAI gpt-image-1, native transparent background support."""

import argparse
import base64
import json
import os
import urllib.request
from pathlib import Path

def generate(prompt, output_path, api_key, size="1024x1024", transparent=True):
    url = "https://api.openai.com/v1/images/generations"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    body = {
        "model": "gpt-image-1",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "output_format": "png",
        "quality": "high"
    }
    if transparent:
        body["background"] = "transparent"

    req = urllib.request.Request(url, json.dumps(body).encode(), headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
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
    parser.add_argument("--output", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--size", default="1024x1024")
    parser.add_argument("--no-transparent", action="store_true")
    args = parser.parse_args()
    generate(args.prompt, args.output, args.api_key, args.size, not args.no_transparent)
