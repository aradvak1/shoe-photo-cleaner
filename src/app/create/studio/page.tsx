import { PhotoWorkflow } from "@/components/create/PhotoWorkflow";

export default function StudioCreatePage() {
  return <PhotoWorkflow mode="studio" endpoint="/api/process-image" />;
}
