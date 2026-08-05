import { PhotoWorkflow } from "@/components/create/PhotoWorkflow";

export default function AtmosphereCreatePage() {
  return <PhotoWorkflow mode="atmosphere" endpoint="/api/process-atmosphere" />;
}
