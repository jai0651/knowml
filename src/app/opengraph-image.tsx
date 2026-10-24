import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "KnowML: machine learning, explained from first principles";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    kicker: "Free systems course",
    title: "Learn how computers really run your code",
    dek: "CPUs, memory, the Linux kernel, concurrency, databases and distributed systems, taught step by step.",
  });
}
