// Rank estimation functions copied verbatim from the Warrior page captured 2026-09-13.
// Source: https://forevertalents.up.railway.app/warrior
  function scaleText(text, from, to, t){
    // Estimate a higher rank from the rank shown in the video. Rules, in order:
    // 1. t.scaleIdx (learned from Classic per-rank text or set by hand): only those numeric tokens scale.
    // 2. t.fixed: numbers listed there never scale.
    // 3. Thresholds and durations never scale: numbers after below/under/above/within/up to/over/every/next/first/lasts/for/than/per/as if.
    // 4. If the text has a "% chance", only chance numbers scale. Otherwise percentages, decimals and "by N" integers scale.
    const fixed = new Set((t && t.fixed) || []);
    const idxOnly = t && t.scaleIdx ? new Set(t.scaleIdx) : null;
    // a chance that would scale past 100% is not the number that scales
    const chanceOverflow = [...text.matchAll(/(\d+(?:\.\d+)?)%\s+chance/gi)].some(m => parseFloat(m[1]) * to / from > 100);
    const hasChance = !chanceOverflow && /\d+(?:\.\d+)?%\s+chance/i.test(text);
    let i = -1;
    return text.replace(/(\b(?:by an additional|by up to|by|an additional|a|an|up to|below|under|above|within|over|every|next|first|lasts|for|than|per|as if you were)\s+)?(\d+(?:\.\d+)?)(%)?(\s+chance)?/gi, (m, pre, num, pct, chance) => {
      i++;
      const tok = num + (pct||'');
      let ok;
      if(idxOnly) ok = idxOnly.has(i);
      else {
        if(fixed.has(tok)) return m;
        if(chanceOverflow && chance) return m;
        const p = (pre||'').trim().toLowerCase();
        if(/^(up to|below|under|above|within|over|every|next|first|lasts|for|than|per|as if you were)$/.test(p)) return m;
        if(hasChance) ok = !!chance;
        else ok = !!pct || /\./.test(num) || /^by/.test(p);
      }
      if(!ok) return m;
      let v = parseFloat(num) * to / from; if(pct && Math.abs(v - 100) <= 1.5) v = 100; if(pct && v > 100) v = 100; const out = Number.isInteger(v) ? String(v) : (Math.round(v*10)/10).toFixed(1);
      return (pre||'') + out + (pct||'') + (chance||'');
    });
  }
  function rankText(t, r){
    if(r < 1) return null;
    if(Array.isArray(t.desc)) return { text: t.desc[Math.min(r,t.desc.length)-1], est:false };
    const known = Object.keys(t.desc).map(Number).sort((a,b)=>a-b);
    if(t.desc[r]) return { text: t.desc[r], est:false };
    const base = known.reduce((b,k)=>Math.abs(k-r)<Math.abs(b-r)?k:b, known[0]);
    return { text: scaleText(t.desc[base], base, r, t), est:true };
  }


module.exports = { rankText };
