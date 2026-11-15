"use client";

import type { AvailabilityStatus } from "@prisma/client";
import { AVAILABILITY_META } from "@/lib/constants";
import { Badge } from "./ui/Badge";
import { useT } from "@/components/i18n/I18nProvider";

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const t = useT();
  const meta = AVAILABILITY_META[status];
  return <Badge tone={meta.tone}>{t(meta.label)}</Badge>;
}
