#!/usr/bin/env python3
"""Poll main from the LAN; ask Coolify to build each new commit once."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request

APP = 'igmvbn44ajkknjou6g6eo4ib'
BASE = 'http://127.0.0.1:8000/api/v1'
TOKEN = Path(os.environ.get('COOLIFY_TOKEN_FILE', '/home/servy/.config/big-dog-flips/coolify-token'))


def api(path, method="GET"):
    request = urllib.request.Request(BASE + path, method=method, headers={
        'Authorization': 'Bearer ' + TOKEN.read_text().strip(),
        'Accept': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    result = subprocess.run(
        ['git', 'ls-remote', 'https://github.com/babygramps/big-dog-flips.git', 'refs/heads/main'],
        check=True, capture_output=True, text=True, timeout=30,
        env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'},
    )
    commit = result.stdout.split()[0]
    deployments = api('/deployments/applications/' + APP)['deployments']
    if any(d['status'] in ('queued', 'in_progress') for d in deployments):
        print('Deployment already queued or running.', flush=True)
        return
    # Do not loop on broken commits; retry manually in Coolify or push a fix.
    latest = max(deployments, key=lambda d: d['id'], default=None)
    if latest and latest['commit'] == commit:
        print(f"main {commit[:12]}: {latest['status']}", flush=True)
        return
    response = api('/deploy?uuid=' + APP, method='POST')
    if not response.get('deployments'):
        raise RuntimeError('Coolify did not return a deployment: ' + str(response))
    print(f'New main {commit}; requested deployment: {response}', flush=True)


if __name__ == '__main__':
    main()
