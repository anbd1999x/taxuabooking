import { serviceInputSchema } from "../../src/lib/validation";
const re = /^\d{4}-\d{2}-\d{2}$/;
const list = "2026-11-28, 2026-11-29,abc".split(",").map((x) => x.trim()).filter((x) => re.test(x));
console.log(list, serviceInputSchema.shape.soldOutDates.safeParse(list).success);
