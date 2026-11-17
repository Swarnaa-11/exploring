# UNFOLD — location-based exploration

A mobile-first exploration app prototype. The real map remains geographically accurate while a fog layer gradually reveals places around the user's movement. The interface offers sensory invitations rather than turn-by-turn directions.

## Run locally

GPS works in a secure browser context. `localhost` is treated as secure by modern browsers.

1. Install Node.js (18 or newer).
2. Open a terminal in this folder.
3. Run:

```bash
npx serve .
```

4. Open the localhost URL printed in the terminal (usually `http://localhost:3000`).
5. On a phone, deploy the folder to an HTTPS static host such as GitHub Pages, Netlify or Vercel to use live GPS. Opening the HTML file directly (`file://`) will not provide reliable GPS access.

No build step, API key or backend is required.

## How to use

- Select **Begin wandering**.
- Choose an intention and optional mood.
- Choose **Use my location** for GPS, or **Explore in demo mode** to test without walking.
- In demo mode use WASD / arrow keys, the on-screen arrows, or swipe on the map to move the avatar.
- The map begins fogged. Moving adds revealed areas around your position.
- Use the **?** button for the Mystery Box, **+** to pin a note/photo, and **▤** to open your personal atlas.
- Double-click the map or tap the location status to open sensory invitations.

## Data and privacy

- Location is processed in the browser and is not sent to an application server.
- Memories and session summary are stored in this browser's local storage. They are not synced between devices.
- Photos are stored with the memory in local browser storage. Large photos may exceed browser storage limits; use smaller images if saving fails.
- Nearby place suggestions are queried from the public OpenStreetMap Overpass API when available. The app gracefully falls back to general sensory prompts if the service is unavailable.
- Map tiles are provided by CARTO using OpenStreetMap data. Internet access is required for map tiles and nearby-place lookup.

## Notes and limitations

- This version uses a stylised dark 2D geographic map with an animated companion marker and a canvas fog-of-war reveal. It is not a photorealistic 3D reconstruction of London.
- GPS accuracy varies by device, weather, buildings and surroundings. The fog reveal uses a conservative radius around reported positions to reduce GPS drift.
- Sensory invitations are prompts for the user to notice the real environment. The app cannot detect smells, ambient sound or what the user is looking at.
- Nearby places are sourced from OpenStreetMap tags and may be incomplete or outdated.
- For a public deployment, use a proper tile provider and review its current usage policy. Public community tile services should not be treated as unlimited production infrastructure.
