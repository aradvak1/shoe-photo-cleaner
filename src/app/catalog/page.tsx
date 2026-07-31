"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Reveal } from "@/components/motion/Reveal";
import type { Catalog } from "@/types";

export default function CatalogListPage() {
  const [catalogs, setCatalogs] = useState<(Catalog & { photo_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalogs")
      .then((res) => res.json())
      .then((data) => setCatalogs(data.catalogs ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">קטלוגים</h1>
          <p className="mt-1 text-sm text-muted">
            קטלוגי PDF שנוצרו מתמונות שמורות, מוכנים לשליחה ללקוחות.
          </p>
        </div>
        <Button href="/photos">בחירת תמונות לקטלוג חדש</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">טוען…</p>
      ) : catalogs.length === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-muted">
            עדיין אין קטלוגים. עברו לגלריה, בחרו תמונות, ולחצו על &quot;צור קטלוג מהנבחרים&quot;.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {catalogs.map((catalog, i) => (
            <Reveal key={catalog.id} index={i}>
              <Link href={`/catalog/${catalog.id}`}>
                <Card interactive className="h-full">
                  <CardBody>
                    <h2 className="font-semibold">{catalog.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge>{catalog.photo_count} תמונות</Badge>
                      {catalog.pdf_url && <Badge tone="success">PDF מוכן</Badge>}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
