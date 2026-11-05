// Set apiBaseUrl to the independently deployed server's API directory.
// mediaCdnBaseUrl is the read switch. Empty keeps /assets/scenes/ on this origin and
// /media/ on the API host. A base such as https://media.arenaofbias.icu (no trailing
// slash) reads /assets/scenes/ and public /media/ from that host. /media/references/
// and /media/pack-references/ stay on the API. Build with MEDIA_CDN_BASE_URL.
// guidedVoting: true makes a staff-only preview of guided blind voting. Build with GUIDED_VOTING=1;
// the public site leaves it out.
globalThis.SAME_PROMPT_CONFIG = { apiBaseUrl: 'api/', mediaCdnBaseUrl: '' };
