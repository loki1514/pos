import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { Planned } from "@/components/admin/Planned";

export const metadata: Metadata = { title: "Delivery" };

export default function Page() {
  return (
    <Planned
      icon={Truck}
      title="Delivery"
      phase="Phase 3 · Operations"
      position="8 of 8"
      blurb="Delivery operations and aggregator channels."
      scope={["Delivery partners","Aggregator orders (Swiggy, Zomato)","Dispatch tracking"]}
    />
  );
}
