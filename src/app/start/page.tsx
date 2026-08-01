import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Reveal } from "@/components/motion/Reveal";

const CATEGORIES = [
  {
    title: "יצירה",
    items: [
      {
        href: "/create",
        title: "עריכת תמונה",
        description: "נקו תמונות נעליים ברקע לבן, או צרו תמונות אווירה על דוגמניות.",
      },
      {
        href: "/catalog",
        title: "יצירת אלבום או קטלוג",
        description: "בחרו תמונות שמורות, בחרו תבנית, וקבלו PDF מוכן לשליחה ללקוח.",
      },
    ],
  },
  {
    title: "ניהול",
    items: [
      {
        href: "/photos",
        title: "גלריה",
        description: "כל התמונות ששמרתם, עם חיפוש וסינון.",
      },
      {
        href: "/logos",
        title: "לוגואים",
        description: "רשימת הלוגואים הזמינים לבחירה בעת יצירת תמונה.",
      },
      {
        href: "/presets",
        title: "עיצובים שמורים",
        description: "הגדירו מראש דגם, מידות, צבע, מחיר ולוגו לבחירה מהירה בעת יצירת תמונה.",
      },
    ],
  },
] as const;

export default function StartPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">לאן תרצו לנווט?</h1>
        <p className="mt-1 text-sm text-muted">כל האפשרויות הזמינות, מסודרות לפי קטגוריה.</p>
      </div>

      {CATEGORIES.map((category, categoryIndex) => (
        <div key={category.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">{category.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {category.items.map((item, itemIndex) => (
              <Reveal key={item.href} index={categoryIndex * category.items.length + itemIndex}>
                <Link href={item.href} className="block">
                  <Card interactive className="h-full">
                    <CardBody>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm text-muted">{item.description}</p>
                    </CardBody>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
