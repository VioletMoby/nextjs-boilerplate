import { neon } from "@neondatabase/serverless"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  // 1. Check for the Admin API Key
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  // 2. Get the font data from the request
  const { font, metadata } = await request.json()
  if (!font || !font.family || !metadata || !metadata.category) {
    return new NextResponse("Missing font data or metadata", { status: 400 })
  }

  if (!process.env.POSTGRES_URL) {
    return new NextResponse("Missing POSTGRES_URL", { status: 500 })
  }

  const sql = neon(process.env.POSTGRES_URL)

  // 3. Use an UPSERT command to update or insert the font
  try {
    await sql`
      INSERT INTO fonts (family, category, variants, subsets, version, last_modified, files)
      VALUES (
        ${font.family}, 
        ${metadata.category}, 
        ${font.variants || ["regular"]},
        ${font.subsets || ["latin"]},
        '1.0',
        NOW(),
        '{}'::jsonb
      )
      ON CONFLICT (family) 
      DO UPDATE SET 
        category = EXCLUDED.category;
    `
    console.log(`Successfully upserted font: ${font.family}`)
    return NextResponse.json({ message: `Successfully updated ${font.family}` })
  } catch (error) {
    console.error("Database update failed:", error)
    return new NextResponse("Error updating database.", { status: 500 })
  }
}
