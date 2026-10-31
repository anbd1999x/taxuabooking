import { PrismaClient } from "@prisma/client";
const p=new PrismaClient();(async()=>{
  const svc=await p.service.findFirst({where:{slug:"may-homestay-ta-xua"}});
  const room=await p.room.findFirst({where:{roomType:{serviceId:svc!.id}},include:{roomType:true}});
  console.log(JSON.stringify({serviceId:svc!.id, roomId:room!.id, name:room!.roomType.name+" · "+room!.name}));
  await p.$disconnect();
})();
