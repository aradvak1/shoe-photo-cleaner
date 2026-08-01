import type { CatalogStyleCategory } from "@/types";

export interface CatalogStyleCategoryMeta {
  id: CatalogStyleCategory;
  label: string;
  description: string;
  /** Which generation endpoint/mode every look in this category routes to. */
  endpoint: "/api/process-image" | "/api/process-atmosphere";
}

export interface CatalogLook {
  id: string;
  categoryId: CatalogStyleCategory;
  label: string;
  description: string;
  /** Seeds the batch's customPrompt; the user's own free text is appended on top. */
  basePrompt: string;
  thumbnail: string;
}

export const CATALOG_STYLE_CATEGORIES: CatalogStyleCategoryMeta[] = [
  {
    id: "atmosphere",
    label: "צילומי חוץ (אווירה)",
    description: "דוגמנית בסצנת חוץ אמיתית — חוף, רחוב, נוף.",
    endpoint: "/api/process-atmosphere",
  },
  {
    id: "studio_model",
    label: "סטודיו על דוגמנית",
    description: "דוגמנית בסטודיו נקי, בלי סצנת חוץ.",
    endpoint: "/api/process-atmosphere",
  },
  {
    id: "product",
    label: "צילומי מוצר לקטלוג",
    description: "המוצר בלבד על רקע נקי, בלי דוגמנית.",
    endpoint: "/api/process-image",
  },
];

export const CATALOG_LOOKS: CatalogLook[] = [
  // atmosphere
  {
    id: "beach-mediterranean",
    categoryId: "atmosphere",
    label: "חוף ים תיכוני",
    description: "אור זהוב, חול לבן, ים טורקיז מטושטש ברקע, לוק חופשה רגוע.",
    basePrompt:
      "a model on a sunlit Mediterranean beach at golden hour, white sand, soft-focus turquoise sea in the background, flowing light linen outfit, warm natural sunlight, relaxed vacation-editorial mood",
    thumbnail: "/catalog-looks/beach-mediterranean.png",
  },
  {
    id: "europe-autumn-street",
    categoryId: "atmosphere",
    label: "רחוב אירופאי בסתיו",
    description: "רחוב אבנים עתיק, עלי סתיו בגווני חום-כתום, אור אחר-צהריים רך.",
    basePrompt:
      "a model walking on a European old-town cobblestone street, warm brown and orange autumn foliage, soft overcast afternoon light, tailored coat, wool textures",
    thumbnail: "/catalog-looks/europe-autumn-street.png",
  },
  {
    id: "tuscan-countryside",
    categoryId: "atmosphere",
    label: "נוף כפרי טוסקני",
    description: "שביל עפר זהוב בין עצי ברוש, וילה כפרית מטושטשת ברקע, שקיעה רכה.",
    basePrompt:
      "a model on a golden dirt path lined with cypress trees, late-afternoon sun, a rustic Tuscan villa in soft focus in the background, relaxed linen dress",
    thumbnail: "/catalog-looks/tuscan-countryside.png",
  },
  // studio_model
  {
    id: "studio-white-minimal",
    categoryId: "studio_model",
    label: "סטודיו לבן מינימלי",
    description: "רקע לבן/קרם חלק, תאורת סטודיו רכה, בלי סצנה או אביזרים.",
    basePrompt:
      "a model against a plain seamless white and cream studio backdrop, soft softbox lighting, simple neutral outfit, clean editorial studio pose, no scene or props",
    thumbnail: "/catalog-looks/studio-white-minimal.png",
  },
  {
    id: "studio-dark-dramatic",
    categoryId: "studio_model",
    label: "סטודיו כהה דרמטי",
    description: "רקע אפור כהה/שחור, תאורה צדדית חדה, מראה מונוכרומטי.",
    basePrompt:
      "a model against a deep charcoal and black seamless studio backdrop, single dramatic side spotlight, high-contrast mood, monochrome outfit",
    thumbnail: "/catalog-looks/studio-dark-dramatic.png",
  },
  {
    id: "studio-warm-beige",
    categoryId: "studio_model",
    label: "סטודיו בז' חמים",
    description: "רקע בז'-קרם חם התואם את פלטת המותג, תאורה מפוזרת רכה.",
    basePrompt:
      "a model against a warm beige and cream seamless studio backdrop matching a luxury brand palette, soft diffused lighting, minimal elegant styling",
    thumbnail: "/catalog-looks/studio-warm-beige.png",
  },
  // product
  {
    id: "backdrop-classic-beige",
    categoryId: "product",
    label: "רקע בז' קלאסי",
    description: "רקע גרדיאנט בז'-קרם חם, צל מגע רך — ברירת המחדל האיכותית.",
    basePrompt:
      "a smooth seamless studio backdrop in warm neutral beige and cream tones with a subtle soft gradient, professional softbox lighting, soft realistic contact shadow beneath the product",
    thumbnail: "/catalog-looks/backdrop-classic-beige.png",
  },
  {
    id: "backdrop-clean-white",
    categoryId: "product",
    label: "רקע לבן נקי",
    description: "רקע לבן אחיד למסחר אלקטרוני, תאורה שווה ללא צללים חדים.",
    basePrompt:
      "a pure white seamless e-commerce product backdrop, even shadow-free lighting, crisp clean studio look",
    thumbnail: "/catalog-looks/backdrop-clean-white.png",
  },
  {
    id: "backdrop-light-marble",
    categoryId: "product",
    label: "רקע שיש בהיר",
    description: "משטח שיש בהיר עם מרקם עדין, אור טבעי רך, תחושת יוקרה.",
    basePrompt:
      "a light marble-textured surface backdrop with subtle veining, soft natural light, understated luxury retail feel",
    thumbnail: "/catalog-looks/backdrop-light-marble.png",
  },
];

export function looksForCategory(categoryId: CatalogStyleCategory): CatalogLook[] {
  return CATALOG_LOOKS.filter((look) => look.categoryId === categoryId);
}
