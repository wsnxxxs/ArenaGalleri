// Reaction stickers: original vector redraws with CSS motion (see platform.css). Ids match the
// server's EMOJIS whitelist. Gradients live once in the document; every sticker references them.
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="stk-face" cx=".38" cy=".3" r=".78"><stop offset="0" stop-color="#fff7c2"/><stop offset=".32" stop-color="#ffe055"/><stop offset=".78" stop-color="#ffb627"/><stop offset="1" stop-color="#f08d12"/></radialGradient>
<linearGradient id="stk-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="stk-cheek"><stop offset="0" stop-color="#ff5f7a" stop-opacity=".7"/><stop offset="1" stop-color="#ff5f7a" stop-opacity="0"/></radialGradient>
<radialGradient id="stk-shadow"><stop offset="0" stop-color="#6b4512" stop-opacity=".3"/><stop offset="1" stop-color="#6b4512" stop-opacity="0"/></radialGradient>
<radialGradient id="stk-mouth" cx=".5" cy=".15" r=".95"><stop offset="0" stop-color="#c2442c"/><stop offset="1" stop-color="#5e170d"/></radialGradient>
<linearGradient id="stk-tongue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa3b3"/><stop offset="1" stop-color="#ef4867"/></linearGradient>
<radialGradient id="stk-heart" cx=".32" cy=".28" r=".85"><stop offset="0" stop-color="#ffc2d2"/><stop offset=".45" stop-color="#ff3d6e"/><stop offset="1" stop-color="#c3123f"/></radialGradient>
<linearGradient id="stk-tear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f6ff"/><stop offset="1" stop-color="#2fa6f0"/></linearGradient>
<radialGradient id="stk-eye" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#6a4020"/><stop offset="1" stop-color="#24140a"/></radialGradient>
<radialGradient id="stk-btn" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffb0ae"/><stop offset=".45" stop-color="#ff3e4e"/><stop offset="1" stop-color="#bd1023"/></radialGradient>
<linearGradient id="stk-btn-side" x1="0" x2="1"><stop offset="0" stop-color="#8e0a1a"/><stop offset=".35" stop-color="#e3283a"/><stop offset=".7" stop-color="#c3172a"/><stop offset="1" stop-color="#7d0716"/></linearGradient>
<radialGradient id="stk-redglow"><stop offset="0" stop-color="#ffd36b" stop-opacity=".95"/><stop offset=".5" stop-color="#ff6a4a" stop-opacity=".45"/><stop offset="1" stop-color="#ff3b3b" stop-opacity="0"/></radialGradient>
<linearGradient id="stk-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdfe"/><stop offset=".55" stop-color="#d3d9e1"/><stop offset="1" stop-color="#939eac"/></linearGradient>
<linearGradient id="stk-skin" x1="0" x2="1"><stop offset="0" stop-color="#ffe6cc"/><stop offset=".65" stop-color="#ffc999"/><stop offset="1" stop-color="#eaa06b"/></linearGradient>
<radialGradient id="stk-green" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#b6f5bd"/><stop offset=".45" stop-color="#37c75e"/><stop offset="1" stop-color="#14833a"/></radialGradient>
<radialGradient id="stk-red" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffc0b5"/><stop offset=".45" stop-color="#ff4b3e"/><stop offset="1" stop-color="#bd1d14"/></radialGradient>
<linearGradient id="stk-wood" x1="0" x2="1"><stop offset="0" stop-color="#e2a467"/><stop offset="1" stop-color="#9a5521"/></linearGradient>
<radialGradient id="stk-ball" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e9b47c"/><stop offset=".5" stop-color="#a8622b"/><stop offset="1" stop-color="#5f3010"/></radialGradient>
<radialGradient id="stk-petal" cx=".5" cy=".9" r="1"><stop offset="0" stop-color="#fff2f7"/><stop offset=".35" stop-color="#ff92c2"/><stop offset="1" stop-color="#ea3b8a"/></radialGradient>
<radialGradient id="stk-burst" cx=".5" cy=".55" r=".75"><stop offset="0" stop-color="#fff4b8"/><stop offset=".4" stop-color="#ffb04a"/><stop offset=".8" stop-color="#ff4d8f"/><stop offset="1" stop-color="#d9277a"/></radialGradient>
<linearGradient id="stk-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe08a"/><stop offset="1" stop-color="#22a04a"/></linearGradient>
<linearGradient id="stk-screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8f4ff"/><stop offset="1" stop-color="#4aa8ea"/></linearGradient>
<linearGradient id="stk-monitor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55606f"/><stop offset="1" stop-color="#262d38"/></linearGradient>
<linearGradient id="stk-shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6bd69a"/><stop offset="1" stop-color="#25875a"/></linearGradient>
<linearGradient id="stk-desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6cfae"/><stop offset="1" stop-color="#b98f61"/></linearGradient>
<linearGradient id="stk-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="stk-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a0"/><stop offset="1" stop-color="#ffb01f"/></linearGradient>
<clipPath id="stk-card"><rect x="3" y="3" width="58" height="58" rx="14"/></clipPath>
<clipPath id="stk-paddle"><circle cx="47" cy="17" r="13.4"/></clipPath>
<clipPath id="stk-screen-clip"><rect x="41" y="11" width="19" height="27" rx="1.6"/></clipPath>
</defs></svg>`;

const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * .16}" fill="url(#stk-shadow)"/>`;
const face = (cx = 32, cy = 34, r = 24) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#stk-face)" stroke="#d2700f" stroke-width="1.5"/>
  <path d="M${cx - r * .78} ${cy + r * .45}A${r * .9} ${r * .9} 0 0 0 ${cx + r * .78} ${cy + r * .45}" fill="none" stroke="#fff1a8" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>
  <ellipse cx="${cx - r * .3}" cy="${cy - r * .55}" rx="${r * .46}" ry="${r * .22}" fill="url(#stk-gloss)" transform="rotate(-22 ${cx - r * .3} ${cy - r * .55})"/>`;
const cheeks = (x1, x2, y, rx = 6) => `<ellipse cx="${x1}" cy="${y}" rx="${rx}" ry="${rx * .62}" fill="url(#stk-cheek)"/><ellipse cx="${x2}" cy="${y}" rx="${rx}" ry="${rx * .62}" fill="url(#stk-cheek)"/>`;
const eye = (x, y, rx, ry, dx = 0, dy = 0, pr = 2.6, cls = 'pupil') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" stroke="#5b3310" stroke-width="1.4"/>
  <g class="${cls}"><circle cx="${x + dx}" cy="${y + dy}" r="${pr}" fill="url(#stk-eye)"/><circle cx="${x + dx - pr * .35}" cy="${y + dy - pr * .4}" r="${pr * .36}" fill="#fff"/><circle cx="${x + dx + pr * .35}" cy="${y + dy + pr * .35}" r="${pr * .16}" fill="#fff"/></g>`;
const heart = 'M0 2.5C0-1.5-6-2-6 2c0 3.4 3.8 5.6 6 7.6 2.2-2 6-4.2 6-7.6 0-4-6-3.5-6 .5z';
const star = 'M0-5.5C.6-1.6 1.6-.6 5.5 0 1.6.6.6 1.6 0 5.5-.6 1.6-1.6.6-5.5 0-1.6-.6-.6-1.6 0-5.5z';
const drop = 'M0-4.5C-1.6-1.6-3-.2-3 1.6a3 3 0 0 0 6 0C3-.2 1.6-1.6 0-4.5z';
const gold = (x, y, t, size = 11) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="900" font-family="system-ui,sans-serif" fill="url(#stk-gold)" stroke="#c4561b" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round">${t}</text>`;

const paddle = (kind) => `<g class="sign">
  <rect x="44.6" y="24" width="3.6" height="28" rx="1.8" fill="url(#stk-wood)" stroke="#7a4116" stroke-width="1"/>
  <circle cx="47" cy="17" r="14" fill="url(#stk-${kind === 'yes' ? 'green' : 'red'})" stroke="${kind === 'yes' ? '#0f6e2f' : '#a3160f'}" stroke-width="1.5"/>
  <circle cx="47" cy="17" r="11" fill="none" stroke="#fff" stroke-width="1.1" opacity=".45"/>
  ${kind === 'yes'
    ? `<path d="M40.5 18.5l4.6 4.6 8.4-9.6" fill="none" stroke="#0d6a2c" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" opacity=".3" transform="translate(.6 1)"/><path d="M40.5 18.5l4.6 4.6 8.4-9.6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M41.5 11.5l11 11m0-11-11 11" stroke="#8d120c" stroke-width="4.4" stroke-linecap="round" opacity=".3" transform="translate(.6 1)"/><path d="M41.5 11.5l11 11m0-11-11 11" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`}
  <g clip-path="url(#stk-paddle)"><path class="shine" d="M38 0h5L33 34h-5z" fill="#fff" opacity=".45"/></g>
  <ellipse cx="42" cy="10" rx="5" ry="2.6" fill="url(#stk-gloss)" transform="rotate(-30 42 10)"/>
  <circle cx="46.4" cy="48" r="5.4" fill="url(#stk-face)" stroke="#d2700f" stroke-width="1.3"/><path d="M42.6 46.4q2.2-1.6 4.6-.4" fill="none" stroke="#d2700f" stroke-width="1.1" stroke-linecap="round"/></g>`;

const STICKERS = [
  { id: 'lick', name: '舔屏', svg: `${shadow(32, 61, 18)}
    <g class="push">${face()}
      ${cheeks(13, 51, 41)}
      <g transform="translate(21 25) scale(1.25)"><path class="heart" d="${heart}" fill="url(#stk-heart)" stroke="#a50f36" stroke-width=".9"/><circle cx="-2.6" cy="1.8" r="1.1" fill="#fff" opacity=".9"/></g>
      <g transform="translate(43 25) scale(1.25)"><path class="heart" d="${heart}" fill="url(#stk-heart)" stroke="#a50f36" stroke-width=".9"/><circle cx="-2.6" cy="1.8" r="1.1" fill="#fff" opacity=".9"/></g>
      <path d="M21 40q11 10 22 0q-11 4-22 0z" fill="url(#stk-mouth)" stroke="#5b3310" stroke-width="1.4" stroke-linejoin="round"/>
      <g class="tongue"><path d="M28.5 42.5q-1.5 12 6.5 13 7.5.5 7.5-7.5 0-4-5-6z" fill="url(#stk-tongue)" stroke="#b72648" stroke-width="1.3"/><path d="M35 45v6" stroke="#d63c5c" stroke-width="1.1" stroke-linecap="round"/><ellipse cx="32" cy="47" rx="1.4" ry="2.4" fill="#fff" opacity=".5"/></g></g>
    <path class="smear" d="M18 50q12 10 28-1" fill="none" stroke="#a9e1ff" stroke-width="3.2" stroke-linecap="round" opacity="0"/>
    <path d="M47 3h6L37 33h-3zM56 6h2.4L46 28h-1.4z" fill="url(#stk-glass)" opacity=".75"/>` },

  { id: 'lol', name: '太好笑', svg: `${shadow(32, 61, 18)}
    <g class="roll">${face(32, 35, 24)}
      ${cheeks(12, 52, 40, 5.5)}
      <path class="ln" d="M14 22q5-4 10-2.5M40 19.5q5-1.5 10 2.5" stroke-width="2"/>
      <path class="ln" d="M14 31q6-8 12-1M38 30q6-7 12 1" stroke-width="3"/>
      <path d="M15.5 37.5h33q-1.5 18-16.5 18t-16.5-18z" fill="url(#stk-mouth)" stroke="#5b3310" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M17 38.2h30q-.4 3.4-2.8 3.8H19.8q-2.4-.4-2.8-3.8z" fill="#fff"/>
      <path d="M24 51.5q8-7 16 0q-8 4-16 0z" fill="#ff7d88"/>
      <g transform="translate(13 32)"><path class="tear" d="${drop}" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width=".8"/><path class="tear d2" d="${drop}" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width=".8"/><path class="tear d3" d="${drop}" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width=".8"/></g>
      <g transform="translate(51 31)"><path class="tear r" d="${drop}" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width=".8"/><path class="tear r d2" d="${drop}" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width=".8"/><path class="tear r d3" d="${drop}" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width=".8"/></g>
      <path d="M11 27q-3 2-4 6M53 26q3 2 4 6" fill="none" stroke="#5fc0ff" stroke-width="2.2" stroke-linecap="round"/></g>` },

  { id: 'press', name: '按一下', svg: `${shadow(32, 61, 26)}
    <g class="base"><ellipse cx="32" cy="51" rx="26" ry="9.5" fill="url(#stk-metal)" stroke="#7d8896" stroke-width="1.1"/>
      <ellipse cx="32" cy="48.5" rx="22.5" ry="7.4" fill="#f5f7fa" stroke="#c5ccd5" stroke-width=".8"/>
      <ellipse cx="32" cy="48" rx="18" ry="5.6" fill="#59616d"/></g>
    <ellipse class="glow" cx="32" cy="40" rx="27" ry="14" fill="url(#stk-redglow)"/>
    <ellipse class="ring" cx="32" cy="46" rx="20" ry="7" fill="none" stroke="#ffb22e" stroke-width="2"/>
    <g class="cap"><path d="M15 36v9a17 6.2 0 0 0 34 0v-9z" fill="url(#stk-btn-side)"/>
      <ellipse cx="32" cy="36" rx="17" ry="6.2" fill="url(#stk-btn)" stroke="#9c0d1f" stroke-width="1.1"/>
      <ellipse cx="25.5" cy="34" rx="7" ry="2" fill="url(#stk-gloss)" opacity=".9"/><path d="M17 42q2 5 7 6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".35"/></g>
    <g class="rays" stroke="#ff9a1f" stroke-width="2.4" stroke-linecap="round"><path d="M9 36l-5-2.5M55 36l5-2.5M12 27l-3.5-4M52 27l3.5-4M20 21l-1.5-4.5M44 21l1.5-4.5"/></g>
    <g class="finger"><g transform="rotate(10 34 20)"><path d="M28 -2h12v24a6 6 0 0 1-12 0z" fill="url(#stk-skin)" stroke="#c98352" stroke-width="1.2"/>
      <path d="M30.6 21.5a3.4 3.4 0 0 0 6.8 0v-4.3h-6.8z" fill="#fff0e2" stroke="#dfa47a" stroke-width=".8"/>
      <path d="M29.5 6q4.5 1.5 9 0M30 9.4q4 1.2 8 0" fill="none" stroke="#d4935f" stroke-width=".9" stroke-linecap="round"/>
      <path d="M30 0v14" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".4"/></g></g>
    <g class="plus">${gold(44, 16, '+1')}</g><g class="plus p2">${gold(4, 22, '+1', 9)}</g><g class="plus p3">${gold(48, 30, '+1', 8)}</g>` },

  { id: 'luck', name: '好运来', svg: `<g clip-path="url(#stk-card)"><rect x="3" y="3" width="58" height="58" fill="url(#stk-burst)"/>
      <g class="rays" fill="#fff" opacity=".22">${Array.from({ length: 12 }, (_, i) => `<path d="M32 34L29.5 -10h5z" transform="rotate(${i * 30} 32 34)"/>`).join('')}</g>
      <circle cx="10" cy="54" r="1.6" fill="#fff6a8"/><circle cx="54" cy="9" r="1.3" fill="#fff"/><circle cx="14" cy="8" r="1" fill="#fff"/></g>
    <rect x="3" y="3" width="58" height="58" rx="14" fill="none" stroke="#fff" stroke-width="2.2"/>
    <g class="dance">
      <path class="arm l" d="M23 40q-7-2-9-11" fill="none" stroke="url(#stk-leaf)" stroke-width="3.2" stroke-linecap="round"/>
      <path class="arm r" d="M41 40q7-2 9-11" fill="none" stroke="url(#stk-leaf)" stroke-width="3.2" stroke-linecap="round"/>
      <g class="arm l"><ellipse cx="13.6" cy="27" rx="3.2" ry="2.4" fill="url(#stk-leaf)" stroke="#16803a" stroke-width=".8" transform="rotate(-50 13.6 27)"/></g>
      <g class="arm r"><ellipse cx="50.4" cy="27" rx="3.2" ry="2.4" fill="url(#stk-leaf)" stroke="#16803a" stroke-width=".8" transform="rotate(50 50.4 27)"/></g>
      <path d="M32 46v14" stroke="url(#stk-leaf)" stroke-width="3" stroke-linecap="round"/>
      <path d="M32 55q-6-5-11-2 4 5 11 2zM32 53q6-5 11-2-4 5-11 2z" fill="url(#stk-leaf)" stroke="#16803a" stroke-width=".7"/>
      <g class="bloom">${Array.from({ length: 9 }, (_, i) => `<ellipse cx="32" cy="15.5" rx="6.6" ry="9.2" fill="url(#stk-petal)" stroke="#d42f7c" stroke-width="1" transform="rotate(${i * 40} 32 30)"/>`).join('')}</g>
      ${face(32, 30, 11.5)}
      ${cheeks(25, 39, 33, 3)}
      <path class="ln" d="M25.5 28.5q2.4-3 4.8 0M33.7 28.5q2.4-3 4.8 0" stroke-width="1.9"/>
      <path d="M27.6 32.4h8.8q-.6 5.4-4.4 5.4t-4.4-5.4z" fill="url(#stk-mouth)" stroke="#5b3310" stroke-width="1" stroke-linejoin="round"/><path d="M29.5 36.4q2.5-2 5 0q-2.5 1.4-5 0z" fill="#ff7d88"/></g>
    <g transform="translate(11 15)"><path class="twinkle" d="${star}" fill="#fff6b0" stroke="#ffb01f" stroke-width=".6"/></g>
    <g class="t2" transform="translate(53 20)"><path class="twinkle" d="${star}" fill="#fff6b0" stroke="#ffb01f" stroke-width=".6"/></g>
    <g class="t3" transform="translate(52 49) scale(.8)"><path class="twinkle" d="${star}" fill="#fff6b0" stroke="#ffb01f" stroke-width=".6"/></g>
    <g class="t4" transform="translate(12 47) scale(.7)"><path class="twinkle" d="${star}" fill="#fff" stroke="#ffb01f" stroke-width=".6"/></g>` },

  { id: 'yes', name: '同意', svg: `${shadow(28, 61, 20)}
    <g class="head">${face(24, 40, 20)}
      ${cheeks(11, 36, 46, 4.6)}
      <path class="ln" d="M12 28.5q4-3.5 9-1.5M26 27q4.5-2 9 1" stroke-width="2"/>
      ${eye(17, 36, 4.4, 4.8, 1.4, -1.6, 2.4)}${eye(30, 35.5, 4.4, 4.8, 1.4, -1.6, 2.4)}
      <path class="ln" d="M14 32.5q3-2 6.5-.6M27.3 32q3-1.6 6.3.3" stroke-width="1.6"/>
      <path d="M18.5 46q6 6 12-1.6q-6 2.6-12 1.6z" fill="url(#stk-mouth)" stroke="#5b3310" stroke-width="1.3" stroke-linejoin="round"/></g>
    ${paddle('yes')}` },

  { id: 'drool', name: '馋了', svg: `${shadow(32, 61, 18)}
    <g class="face">${face()}
      <ellipse cx="13" cy="39.5" rx="8.5" ry="5.4" fill="url(#stk-cheek)"/><ellipse cx="51" cy="39.5" rx="8.5" ry="5.4" fill="url(#stk-cheek)"/>
      <path d="M9 40.5l2-3M12.5 41l2-3M16 41l2-3M48 41l2-3M51.5 41l2-3M55 40.5l2-3" stroke="#f0506d" stroke-width="1" stroke-linecap="round" opacity=".7"/>
      <path class="ln" d="M13 21.5q5-4.5 11-2.5M40 19q6-2 11 2.5" stroke-width="2.2"/>
      ${eye(21, 30.5, 6, 6.4, 0, 0, 3.2)}${eye(43, 30.5, 6, 6.4, 0, 0, 3.2)}
      <path d="M23 41q9 9 18 0q-9 3.4-18 0z" fill="url(#stk-mouth)" stroke="#5b3310" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M27 44.5q5-2.6 10 0q-5 2-10 0z" fill="#ff7d88"/>
      <path class="drip" d="M36.4 44q.6 7 2 10.5a2.6 2.6 0 0 0 4.6-.8q-.6-4.4-3.4-10.4z" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width="1"/>
      <path class="drip" d="M38.3 46.5q.4 3 1.2 5" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".8"/>
      <g class="drop"><path d="${drop}" transform="translate(40.6 59) scale(.55)" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width="1.2"/></g></g>` },

  { id: 'knock', name: '敲敲', svg: `${shadow(32, 61, 25)}
    <g class="blob"><path d="M7 53C5 36 18 27 32 27s27 9 25 26c-.6 6-10 7.4-25 7.4S7.6 59 7 53z" fill="url(#stk-face)" stroke="#d2700f" stroke-width="1.5"/>
      <ellipse cx="21" cy="34" rx="8.6" ry="3.4" fill="url(#stk-gloss)" transform="rotate(-14 21 34)"/>
      ${cheeks(14, 50, 50, 5)}
      <g class="eyes-calm"><path class="ln" d="M16.5 44q4 3.4 8 0M39.5 44q4 3.4 8 0" stroke-width="2.4"/></g>
      <g class="eyes-hit"><path class="ln" d="M17 41.5l6.5 2.8-6.5 2.8M47 41.5l-6.5 2.8 6.5 2.8" stroke-width="2.2"/></g>
      <path class="ln" d="M28.6 49.4q1.7 2 3.4 0q1.7 2 3.4 0" stroke-width="1.6"/></g>
    <g class="hit" stroke="#ffb01f" stroke-width="2" stroke-linecap="round"><path d="M24 24l-3-3M44 23l3-3M34 17v-3"/></g>
    <g class="mallet"><path d="M58 6 38.6 20.6" stroke="url(#stk-wood)" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="35.4" cy="23" r="5.8" fill="url(#stk-ball)" stroke="#4a240b" stroke-width="1"/><ellipse cx="33.6" cy="20.8" rx="2" ry="1.3" fill="#fff" opacity=".5"/></g>
    <g class="plus">${gold(4, 21, '+1', 12)}</g>` },

  { id: 'stare', name: '盯', svg: `
    <rect x="0" y="55" width="64" height="7" rx="2" fill="url(#stk-desk)"/>
    <path d="M50 42v9" stroke="#2a313c" stroke-width="3"/><path d="M43 53q7-3.5 14 0z" fill="#2a313c"/>
    <rect x="38" y="8" width="25" height="34" rx="3.5" fill="url(#stk-monitor)" stroke="#1a2029" stroke-width="1.2"/>
    <rect x="41" y="11" width="19" height="27" rx="1.6" fill="url(#stk-screen)"/>
    <g clip-path="url(#stk-screen-clip)"><g class="lines" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"><path d="M44 16h12M44 20h9M44 24h11M44 28h7M44 32h12M44 36h9M44 40h11M44 44h8"/></g></g>
    <rect class="glow" x="41" y="11" width="19" height="27" rx="1.6" fill="#fff"/>
    <path d="M52 11h5L46 38h-5z" fill="#fff" opacity=".22"/>
    <g class="lean"><path d="M-2 64q1-15 18-16 17 1 19 16z" fill="url(#stk-shirt)" stroke="#1d6b45" stroke-width="1.2"/><path d="M11 49q5 5 10 0" fill="none" stroke="#1d6b45" stroke-width="1.2"/>
      <ellipse cx="4.6" cy="33" rx="3" ry="4" fill="#ffc531" stroke="#d2700f" stroke-width="1.2"/>
      ${face(19, 31, 16)}
      <path d="M17 15.4q1-5 5.6-4" fill="none" stroke="#5b3310" stroke-width="1.4" stroke-linecap="round"/>
      ${cheeks(10, 30, 38, 3.6)}
      ${eye(16, 30, 3.8, 3.6, 1.3, 0, 2)}${eye(26.5, 30, 3.8, 3.6, 1.3, 0, 2)}
      <g class="lid"><path d="M12 26.2h8.3v3.7H12zM22.5 26.2h8.3v3.7h-8.3z" fill="#ffcf3a"/><path class="ln" d="M12.2 29.9h8M22.6 29.9h8" stroke-width="1.5"/></g>
      <path class="ln" d="M11.5 23.6l7.4 2M24 25.6l7.4-2" stroke-width="2.2"/>
      <path class="ln" d="M18 39.5q3-1.2 6 0" stroke-width="1.8"/></g>` },

  { id: 'no', name: '不行', svg: `${shadow(26, 61, 20)}
    <g class="head">${face(24, 40, 20)}
      ${cheeks(11, 36, 46, 4.6)}
      <path class="ln" d="M12 29q4.5-1 8.5 1.6M27 30.6q4-2.6 8.5-1.6" stroke-width="2"/>
      <path class="ln" d="M13.5 35l6 2.6-6 2.6M34.5 35l-6 2.6 6 2.6" stroke-width="2.4"/>
      <path class="ln" d="M17.5 48q2-2.2 4 0t4 0 4 0" stroke-width="1.8"/>
      <g class="sweat"><path d="${drop}" transform="translate(8 27) scale(.9)" fill="url(#stk-tear)" stroke="#1d86cc" stroke-width="1"/></g></g>
    ${paddle('no')}` },
];


const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));
export const stickerName = (id) => BY_ID.get(id)?.name ?? id;

let mounted = false;
export function sticker(id, { on = false } = {}) {
  const s = BY_ID.get(id);
  if (!s) return '';
  if (!mounted && typeof document !== 'undefined') { document.body.insertAdjacentHTML('afterbegin', DEFS); mounted = true; }
  return `<svg class="stk stk-${s.id}${on ? ' on' : ''}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${s.svg}</svg>`;
}
