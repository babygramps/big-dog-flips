# Coolify deployment

The app runs on serverdude (`10.0.0.130`), managed by Coolify at
`http://10.0.0.130:8000`, under **My first project / production / Big Dog Flips**.
Its resource UUID is `iyscpywxcaqzkehhkmqvbnxm`.
The LAN app URL is `http://big-dog-flips.10.0.0.130.sslip.io`.

## Automatic updates

Coolify builds the public repository `https://github.com/babygramps/big-dog-flips`
from `main` using the committed Dockerfile. Every minute, the server's
`big-dog-flips-auto-deploy.timer` runs `scripts/coolify-auto-deploy.py` (installed
at `/home/servy/apps/big-dog-flips-auto-deploy.py`). It checks GitHub and calls
Coolify's localhost API when main differs from the latest attempted deployment.
No public Coolify webhook, dashboard exposure, or GitHub credentials are needed.

The Docker build runs `npm test` and then `npm run build`. A failed build leaves
the existing container running. Failed commits are not retried every minute:
use **Deploy** in Coolify to retry, or push a fix. The timer skips active builds.
Coolify deployment logs record the Git commit and result. The timer starts on boot.

```sh
sudo systemctl status big-dog-flips-auto-deploy.timer
sudo journalctl -u big-dog-flips-auto-deploy.service -n 30
sudo systemctl start big-dog-flips-auto-deploy.service # check immediately
sudo systemctl stop big-dog-flips-auto-deploy.timer  # pause automatic updates
```

Pause the timer before rolling back in Coolify, otherwise it will restore main.
Resume with `sudo systemctl start big-dog-flips-auto-deploy.timer`.
The previous manual image remains at `127.0.0.1:5000/big-dog-flips:local`.
The original application configuration is saved privately on the server at
`/home/servy/.config/big-dog-flips/application-before-git.json`.
The polling token is in the same directory in `coolify-token` (mode 0600), with
Coolify read/deploy permissions. Never commit it. Updating the polling script in
Git requires copying it to the installed path above.

## Build and runtime

`server.js` serves the Vite build, SPA routes, `/healthz`, and all three API
handlers on port 3000. The container retains the name `big-dog-flips` for the
existing tunnel. Coolify provides `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
and `VITE_GIPHY_API_KEY` at build time and runtime. These are public frontend
values; never put privileged credentials in Docker build arguments. Local
`.env*` files are excluded from Docker builds. `MUSICFETCH_TOKEN` is optional
and must be runtime-only if supplied.

The existing Vercel reverse proxy and `big-dog-flips-tunnel` remain in place.
Vercel's Git integration is disconnected so pushing main cannot replace that
proxy. The temporary Cloudflare Quick Tunnel changes hostname if restarted;
that still requires updating Vercel's proxy origin. Supabase remains hosted.
No additional playlist scheduler is installed by this deployment setup.
