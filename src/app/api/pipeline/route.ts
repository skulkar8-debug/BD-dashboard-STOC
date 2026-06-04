import { NextRequest, NextResponse } from "next/server";
import { fetchPipelineData } from "@/lib/sheets";
import { parseISO, isValid, subDays } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const to = toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
  const from = fromParam && isValid(parseISO(fromParam)) ? parseISO(fromParam) : subDays(to, 7);

  try {
    const rows = await fetchPipelineData(from, to);
    return NextResponse.json({ rows, from: from.toISOString(), to: to.toISOString() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load data" }, { status: 500 });
  }
}
