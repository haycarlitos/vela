import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

// GET /api/init — creates tables if they don't exist
// Call once after setting up the database
export async function GET() {
  try {
    await initDb();
    return NextResponse.json({ success: true, message: "Tables created" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
