import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moovenco · Scolaire",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
