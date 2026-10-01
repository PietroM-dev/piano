'use strict';

// Lettore minimale di file MIDI standard (formato 0 e 1).
// Restituisce solo ciò che serve all'app: le note di ogni traccia e l'armatura di chiave.
function parseMidi(arrayBuffer) {
  const v = new DataView(arrayBuffer);
  let p = 0;
  const u8 = () => v.getUint8(p++);
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(p + i)); p += n; return s; };
  const vlq = () => { let x = 0, b; do { b = u8(); x = (x << 7) | (b & 0x7f); } while (b & 0x80); return x; };

  if (v.byteLength < 14 || str(4) !== 'MThd') throw new Error('Non è un file MIDI');
  const headerLen = u32();
  u16(); // formato
  const nTracks = u16();
  const division = u16();
  p = 8 + headerLen;

  const tracks = [];
  let keySig = null;
  for (let t = 0; t < nTracks && p + 8 <= v.byteLength; t++) {
    const id = str(4);
    const len = u32();
    const end = Math.min(p + len, v.byteLength);
    if (id !== 'MTrk') { p = end; continue; }
    let tick = 0, status = 0, name = '';
    const notes = [];
    while (p < end) {
      tick += vlq();
      let b = u8();
      if (b === 0xff) {
        const type = u8(), l = vlq();
        if (type === 0x03 && !name) name = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer, p, l)).trim();
        if (type === 0x59 && keySig === null) keySig = v.getInt8(p);
        p += l;
        if (type === 0x2f) break;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) { p += vlq(); continue; }
      if (b < 0x80) { // running status: riusa lo status precedente
        if (!status) break;
        p--;
        b = status;
      } else {
        status = b;
      }
      const kind = b >> 4, ch = b & 0x0f;
      const d1 = u8();
      const d2 = kind === 0xc || kind === 0xd ? 0 : u8();
      if (kind === 0x9 && d2 > 0 && ch !== 9) notes.push({ tick, midi: d1 }); // canale 10 = batteria
    }
    p = end;
    if (notes.length) tracks.push({ name: name || `Traccia ${tracks.length + 1}`, notes });
  }
  if (!tracks.length) throw new Error('Il file non contiene note');
  return { tracks, keySig: keySig || 0, division };
}

// Riduce il brano a una sola linea di note (il microfono ne riconosce una alla volta):
// le note che partono insieme formano un accordo, e di ogni accordo si tiene la più acuta o la più grave.
function extractLine(parsed, trackIdx, part) {
  const src = trackIdx < 0 ? parsed.tracks.flatMap(t => t.notes) : parsed.tracks[trackIdx].notes;
  const sorted = [...src].sort((a, b) => a.tick - b.tick);
  const tol = parsed.division & 0x8000 ? 10 : Math.max(1, parsed.division >> 3);
  const line = [];
  let groupStart = -Infinity, pick = null;
  for (const n of sorted) {
    if (n.tick - groupStart > tol) {
      if (pick !== null) line.push(pick);
      groupStart = n.tick;
      pick = n.midi;
    } else {
      pick = part === 'low' ? Math.min(pick, n.midi) : Math.max(pick, n.midi);
    }
  }
  if (pick !== null) line.push(pick);
  return line;
}

if (typeof module !== 'undefined') module.exports = { parseMidi, extractLine };
