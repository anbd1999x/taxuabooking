const P = { hn:[21.0285,105.8542], sapa:[22.3363,103.8437], tx:[21.2795,104.4275], moc:[20.8467,104.6355] };
for (const [a,b,cost] of process.argv.slice(2).map(s=>s.split(","))) {
  const v = await (await fetch("https://valhalla1.openstreetmap.de/route",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({locations:[a,b].map(k=>({lat:P[k][0],lon:P[k][1]})),costing:cost||"motorcycle",units:"kilometers"})})).json();
  const out=[];
  for (const m of v.trip.legs[0].maneuvers) { const n=(m.street_names||["?"]).join("/"); if (m.length>=3) out.push(`${n}:${m.length.toFixed(0)}`); }
  console.log(a,b,cost, v.trip.summary.length.toFixed(0), (v.trip.summary.time/3600).toFixed(1)+"h ::", out.join(" | "));
}
