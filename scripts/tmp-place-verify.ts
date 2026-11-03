import { PrismaClient } from "@prisma/client";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
const prisma = new PrismaClient();
async function main(){
  const ps = await prisma.place.findMany({ select:{kind:true,name:true,coverImage:true}, orderBy:[{kind:"asc"},{sortOrder:"asc"}] });
  const miss = ps.filter(p=>!p.coverImage);
  const withCover = ps.filter(p=>p.coverImage);
  console.log("Tổng quán:",ps.length,"| có ảnh bìa:",withCover.length,"| thiếu:",miss.length);
  if(miss.length) for(const m of miss) console.log("  THIẾU:",m.kind,m.name);
  // check files on disk
  let bad=0;
  for(const p of withCover){
    if(!p.coverImage!.startsWith("/uploads/")) continue;
    const fp = path.join(process.cwd(),"public",p.coverImage!);
    if(!existsSync(fp)||statSync(fp).size<1000){ bad++; console.log("  FILE LỖI:",p.name,p.coverImage); }
  }
  console.log("File ảnh lỗi/thiếu:",bad);
}
main().finally(()=>prisma.$disconnect());
