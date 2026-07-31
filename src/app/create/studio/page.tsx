import { CreationFlow } from "@/components/create/CreationFlow";

export default function StudioCreatePage() {
  return <CreationFlow mode="studio" endpoint="/api/process-image" />;
}
