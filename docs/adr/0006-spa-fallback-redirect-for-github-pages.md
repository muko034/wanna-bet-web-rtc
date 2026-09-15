# Clean Room-link URLs on GitHub Pages via a 404.html redirect trick, not hash routing

GitHub Pages serves static files with no server-side rewrites, so a direct visit or refresh of a shared Room link
(`/room/:code`) would 404 by default. We considered switching `preact-router` to hash-based routing
(`/#/room/:code`), which needs no host-specific workaround and stays portable to any static host, but chose instead
to add a `404.html` that redirects unmatched paths back to `index.html` with the original path encoded in the query
string, which `index.html` then rewrites back via `history.replaceState` before the router mounts. This keeps shared
Room links clean (no `#`) at the cost of an extra redirect hop on cold deep-link loads and GitHub-Pages-specific
boilerplate that would need to be removed (not ported) if hosting ever moves elsewhere.
