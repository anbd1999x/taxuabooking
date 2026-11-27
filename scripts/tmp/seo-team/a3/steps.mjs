const P = { hn:[21.0285,105.8542], sapa:[22.3363,103.8437], tx:[21.2795,104.4275], moc:[20.8467,104.6355] };
for (const [a,b] of process.argv.slice(2).map(s=>s.split(","))) {
  const o = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${P[a][1]},${P[a][0]};${P[b][1]},${P[b][0]}?overview=false&steps=true`)).json();
  const out=[]; let acc=0, cur=null, d=0;
  for (const s of o.routes[0].legs[0].steps) { const n=(s.ref||s.name||"?"); if(n!==cur){ if(cur) out.push(`${cur}:${(d/1000).toFixed(0)}`); cur=n; d=0;} d+=s.distance; }
  out.push(`${cur}:${(d/1000).toFixed(0)}`);
  console.log(a,b, out.filter(x=>!x.endsWith(":0")).join(" | "));
}
