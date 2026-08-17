import { Aurora } from "@/components/ui/Aurora";
import { CTA } from "@/components/landing/CTA";
import { Hero } from "@/components/landing/Hero";
import { Modules } from "@/components/landing/Modules";
import { Nav } from "@/components/landing/Nav";
import { OneOrder } from "@/components/landing/OneOrder";
import { Roles } from "@/components/landing/Roles";
import { Workflows } from "@/components/landing/Workflows";

export default function Home() {
  return (
    <main className="relative min-h-dvh">
      <Aurora />
      <Nav />
      <Hero />
      <OneOrder />
      <Modules />
      <Workflows />
      <Roles />
      <CTA />
    </main>
  );
}
