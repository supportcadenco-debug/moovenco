import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moovenco · Planning",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
