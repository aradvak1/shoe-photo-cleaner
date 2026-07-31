import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Reveal } from "@/components/motion/Reveal";

const MODES = [
  {
    href: "/create/studio",
    title: "תמונת סטודיו",
    description: "רקע לבן אחיד ונקי, לתמונות קטלוג קלאסיות.",
  },
  {
    href: "/create/atmosphere",
    title: "תמונת אווירה",
    description: "הנעל בחוץ, על דוגמנית, בסצנת חיים אמיתית.",
  },
] as const;

export default function CreateModePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">עריכת תמונה</h1>
        <p className="mt-1 text-sm text-muted">באיזה סוג עריכה תרצו להשתמש?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODES.map((m, i) => (
          <Reveal key={m.href} index={i}>
            <Link href={m.href} className="block">
              <Card interactive className="h-full">
                <CardBody>
                  <h2 className="text-lg font-semibold">{m.title}</h2>
                  <p className="mt-2 text-sm text-muted">{m.description}</p>
                </CardBody>
              </Card>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
