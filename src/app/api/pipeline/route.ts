import { NextRequest, NextResponse } from "next/server";
import { isValid, parseISO, subDays } from "date-fns";
import { isGoogleOAuthConfigured } from "@/lib/google/config";
import { googleApiErrorResponse } from "@/lib/google/errors";
import { fetchPipelineSheetValues } from "@/lib/google/sheets";
import { geocodePipelineRows } from "@/lib/sheets";
import { parsePipelineRows } from "@/lib/sheets/pipelineParser";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and AUTH_SECRET.",
      },
      { status: 503 }
    );
  }

  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const to =
    toParam && isValid(parseISO(toParam)) ? parseISO(toParam) : new Date();
  const from =
    fromParam && isValid(parseISO(fromParam))
      ? parseISO(fromParam)
      : subDays(to, 7);

  try {
    const sheetRows = await fetchPipelineSheetValues();
    const parsed = parsePipelineRows(sheetRows, from, to);
    const rows = await geocodePipelineRows(parsed);
    return NextResponse.json({
      rows,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  } catch (err) {
    console.error(err);
    return googleApiErrorResponse(err, "/bd");
  }
}
