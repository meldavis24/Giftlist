# GiftList browser extension

Manifest V3 extension: adds the current tab's product page to one of your
GiftList lists. Not published to the Chrome Web Store -- load it unpacked for
now.

## Load it in Chrome/Edge

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select this `extension/` folder
4. Click the extension's icon, then "Set up the extension" to configure:
   - **GiftList app URL** — where the web app is running (e.g.
     `http://localhost:3000` while developing)
   - **API token** — generate one from the app at `/settings/tokens`

## Notes

- `host_permissions: ["<all_urls>"]` in `manifest.json` is intentionally broad
  since the app URL is user-configurable (localhost during dev, a real domain
  once deployed). Narrow this to your actual domain before distributing the
  extension beyond your own machine.
- The extension never sees your GiftList password -- it authenticates with the
  personal access token you generate, which can be revoked independently from
  `/settings/tokens`.
