const UA = { "User-Agent": "travel-route-check/1.0" };
const q = ["Bắc Yên, Sơn La","Phù Yên, Sơn La","Thanh Sơn, Phú Thọ","Thu Cúc, Phú Thọ","Mường Cơi, Sơn La","Sa Pa, Lào Cai","Hoàn Kiếm, Hà Nội","Sơn Tây, Hà Nội","Mộc Châu, Sơn La","Gia Phù, Sơn La"];
for (const s of q) { const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(s), { headers: UA }); const j = await r.json(); console.log(s, j[0]?.lat, j[0]?.lon, j[0]?.display_name?.slice(0,80)); await new Promise(r=>setTimeout(r,1100)); }
