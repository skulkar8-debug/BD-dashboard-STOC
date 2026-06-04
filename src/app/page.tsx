import { Dashboard } from "@/components/Dashboard";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <div className="bg-blue-600 text-white text-center text-xs py-2 px-4">
        New:{" "}
        <Link href="/bd" className="underline font-semibold hover:text-blue-100">
          Instantly BD Dashboard →
        </Link>
      </div>
      <Dashboard />
    </>
  );
}
