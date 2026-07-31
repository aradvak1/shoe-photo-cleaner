import { CreationFlow } from "@/components/create/CreationFlow";

export default function AtmosphereCreatePage() {
  return <CreationFlow mode="atmosphere" endpoint="/api/process-atmosphere" />;
}
