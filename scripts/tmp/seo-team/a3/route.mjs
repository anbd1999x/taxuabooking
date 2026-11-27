const P = { hn:[21.0285,105.8542], sapa:[22.3363,103.8437], tx:[21.2795,104.4275], bacyen:[21.2445,104.4180], mcc:[21.8530,104.0880], nghialo:[21.6010,104.5110], tramtau:[21.4640,104.3790], moc:[20.8467,104.6355], tuoile:[21.7930,104.3050], thanuyen:[21.9570,103.8870], phuyen:[21.2600,104.6400], sonla:[21.3270,103.9140], thucuc:[21.1390,104.9810], thanhson:[21.2000,105.1900], phuyen2:[21.2640,104.6460], gia_phu:[21.1500,104.6500] };
const legs = process.argv.slice(2).map(s=>s.split(","));
for (const pts of legs) {
  const c = pts.map(k=>`${P[k][1]},${P[k][0]}`).join(";");
  const o = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${c}?overview=false&steps=false`)).json();
  let line = pts.join(">")+": OSRM ";
  if (o.routes) line += (o.routes[0].distance/1000).toFixed(0)+"km "+(o.routes[0].duration/3600).toFixed(1)+"h legs="+o.routes[0].legs.map(l=>(l.distance/1000).toFixed(0)).join("+");
  try {
    const v = await (await fetch("https://valhalla1.openstreetmap.de/route",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({locations:pts.map(k=>({lat:P[k][0],lon:P[k][1]})),costing:"motorcycle",units:"kilometers"})})).json();
    if (v.trip) line += " | VALHALLA moto "+v.trip.summary.length.toFixed(0)+"km "+(v.trip.summary.time/3600).toFixed(1)+"h legs="+v.trip.legs.map(l=>l.summary.length.toFixed(0)).join("+");
    else line += " | V err "+JSON.stringify(v).slice(0,100);
  } catch(e){ line += " | V fail"; }
  console.log(line);
}
