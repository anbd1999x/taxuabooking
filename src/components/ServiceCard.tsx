import Link from "next/link";
import type { ServiceCard as ServiceCardData } from "@/lib/queries";
import { CATEGORIES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { Badge } from "./ui/Badge";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { CardSlider } from "./CardSlider";

export function ServiceCard({ service }: { service: ServiceCardData }) {
  const cat = CATEGORIES[service.category];
  const href = `/${cat.slug}/${service.slug}`;
  const price = service.availability?.fromPrice ?? service.basePrice;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-forest-50">
        <CardSlider images={service.images} title={service.title} />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
          <Badge tone="ok" className="bg-white/90 text-forest-700 ring-white">
            {cat.shortLabel}
          </Badge>
          {service.featured && (
            <Badge tone="warn" className="bg-sunset-500/95 text-white ring-sunset-400">
              Nổi bật
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-semibold text-ink group-hover:text-forest-700">
          {service.title}
        </h3>
        {service.area && (
          <p className="text-xs text-gray-500">📍 {service.area}</p>
        )}
        <p className="line-clamp-2 text-sm text-gray-600">{service.summary}</p>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <span className="text-lg font-bold text-forest-700">
              {formatPrice(price)}
            </span>
            {price != null && service.priceUnit && (
              <span className="text-xs text-gray-500">{service.priceUnit}</span>
            )}
          </div>
          {service.availability && (
            <AvailabilityBadge status={service.availability.status} />
          )}
        </div>
      </div>
    </Link>
  );
}
