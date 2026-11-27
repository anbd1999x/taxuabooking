import sharp from "sharp";
const [out, ...urls] = process.argv.slice(2);
const W=320,H=220, cols=4;
const tiles=[];
for (const [i,u] of urls.entries()) {
  try {
    const r = await fetch(`https://taxuabooking.com/thumb?u=${encodeURIComponent(u)}&w=384`);
    const buf = Buffer.from(await r.arrayBuffer());
    const img = await sharp(buf).resize(W,H,{fit:"cover"}).composite([{input:Buffer.from(`<svg width="${W}" height="${H}"><rect width="40" height="26" fill="black"/><text x="5" y="20" font-size="20" fill="yellow">${i}</text></svg>`)}]).png().toBuffer();
    tiles.push({input:img, left:(i%cols)*W, top:Math.floor(i/cols)*H});
  } catch(e){ console.log("fail",i,u); }
}
const rows=Math.ceil(urls.length/cols);
await sharp({create:{width:cols*W,height:rows*H,channels:3,background:"#fff"}}).composite(tiles).jpeg({quality:70}).toFile(out);
urls.forEach((u,i)=>console.log(i,u));
