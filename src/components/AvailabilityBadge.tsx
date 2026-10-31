import type { AvailabilityStatus } from "@prisma/client";
import { AVAILABILITY_META } from "@/lib/constants";
import { Badge } from "./ui/Badge";

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const meta = AVAILABILITY_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
