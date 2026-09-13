# Headless compute donor

This service opens the hosted simulator in headless Chromium and contributes its
idle WASM workers to the coordinator. It uses the deployed site's loader, bundle
hash, scheduling, and integrity checks. It can donate to both game modes in that
bundle's pool. No local simulation build, coordinator, worker token, or site change
is needed. Its browser context is separate from your regular browser profiles.

## Run on this machine

From the repository root, with Node.js 20.3 or newer:

```sh
npm ci --prefix compute
npm run --prefix compute install:browser
npm run compute:headless
```

The default site is `https://fleetcode.com/WarriorSim/`. The service defaults to
45% of the available logical CPUs, rounded down, then clamped to 2–64 threads.
On my 64-core server, 128 logical CPUs yield **57 threads** (`floor(128 × 0.45)`).
A donated thread consumes CPU only when another participant
has work for it. Logs report the connection, bundle hash, and active/queued work.
Ctrl+C stops the service and its browser workers.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMPUTE_SITE` | `https://fleetcode.com/WarriorSim/` | Simulator directory or HTML page URL; the coordinator is `./compute` |
| `COMPUTE_THREADS` | Calculation above | Integer from 2 to 64 |
| `COMPUTE_CHROMIUM_PATH` | Playwright's installed Chromium | Use a specific Chrome/Chromium executable |

For example:

```sh
COMPUTE_THREADS=8 npm run compute:headless
```

Chromium runs with its sandbox enabled. On a fresh Linux installation that lacks
browser libraries, install them with `cd compute && npx playwright install-deps chromium`.
The browser installer preserves other Playwright browser versions on the machine.

## Run as a user service

The supplied unit uses `/usr/bin/node` and `~/github/WarriorSim`, matching my
machine. Adjust those two paths in your installed unit if necessary.

```sh
mkdir -p ~/.config/systemd/user
cp compute/warriorsim-compute.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now warriorsim-compute
journalctl --user -u warriorsim-compute -f
```

Optional overrides go in `~/.config/warriorsim-compute.env`, for example
`COMPUTE_THREADS=8`. After editing it, run
`systemctl --user restart warriorsim-compute`.

```sh
systemctl --user status warriorsim-compute
systemctl --user stop warriorsim-compute
systemctl --user disable --now warriorsim-compute
```

The unit runs at reduced scheduling priority and stops the entire browser process
group on shutdown. A user service normally runs with your login session. To run
at boot and survive logout, an administrator can enable lingering for your account
with `loginctl enable-linger "$USER"`.

## Reconnects and deployments

Restarting the coordinator terminates its WebSockets. A disconnect is a reason to
**check** for an update; a network failure can produce the same signal.

The service checks `dist/compute-build.json` after a disconnect and after the next
handshake, coalescing checks to at most once every five seconds. It also checks
once a minute, so a static-only deployment does not require a coordinator restart.
If the advertised `buildId` is unchanged, it keeps the loaded bundle and lets the
site reconnect. If it changed, the service reloads the page; the site verifies the
new manifest and all assets before joining the new pool. It never relabels running
old code with a new hash. Reloading cancels current donations; the coordinator
requeues their leases.

Failed version checks retain the loaded bundle and retry. A partial deployment
that fails preload verification, a page failure, or a browser exit causes a fresh
browser attempt with backoff from 5 to 60 seconds. The site's own WebSocket
reconnect backoff handles coordinator outages; an additional connection attempt
every 30 seconds recovers policy closes that older clients do not retry.

The supervisor depends on the site's current `simulatorReady`, `SIMULATOR_BUNDLE`,
and `sharedCompute` interfaces. Changes to those interfaces may require updating
this small launcher. Site deployments update simulation code automatically;
updating Playwright/Chromium or the launcher itself requires maintaining the local
service package. Ordinary browser tabs are unaffected by this service.

## Verification

```sh
npm ci --prefix server
npm test --prefix compute
```

The tests use a real Chromium browser, real WASM workers, and a local WebSocket
coordinator. They cover a donated simulation, reconnecting without a reload,
unavailable manifests, new bundle adoption, deployments without a restart,
incomplete uploads, browser recovery, and shutdown. Rollout tests keep their deployment assets in
memory and do not rebuild or modify the shared checkout. They require the existing
`dist` assets to be a complete, consistent build.
