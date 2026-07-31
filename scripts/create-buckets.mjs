import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const buckets = [
  { id: "originals", public: true },
  { id: "clean-images", public: true },
  { id: "logos", public: true },
];

for (const bucket of buckets) {
  const { error } = await supabase.storage.createBucket(bucket.id, {
    public: bucket.public,
  });
  if (error && !error.message.includes("already exists")) {
    throw error;
  }
  console.log(`Bucket ready: ${bucket.id}`);
}
