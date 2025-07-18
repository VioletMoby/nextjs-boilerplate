// Use require for CommonJS modules
const dotenv = require("dotenv")
const { neon } = require("@neondatabase/serverless")

// Load environment variables from .env.development.local
dotenv.config({ path: ".env.development.local" })

const apiKey = process.env.GOOGLE_FONTS_API_KEY
const dbUrl = process.env.POSTGRES_URL

if (!apiKey) {
  console.error("Error: GOOGLE_FONTS_API_KEY is not defined in your .env file.")
  process.exit(1)
}

if (!dbUrl) {
  console.error("Error: POSTGRES_URL is not defined. Please link your Vercel project.")
  process.exit(1)
}

const sql = neon(dbUrl)

async function fetchFonts() {
  console.log("Fetching fonts from Google Fonts API...")
  try {
    const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}`)
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }
    const data = await response.json()
    console.log(`Successfully fetched ${data.items.length} font families.`)
    return data.items
  } catch (error) {
    console.error("Failed to fetch fonts:", error)
    return []
  }
}

async function seedDatabase() {
  const fonts = await fetchFonts()

  if (fonts.length === 0) {
    console.log("No fonts to seed. Exiting.")
    return
  }

  console.log("Starting to seed the database...")

  try {
    await sql`DROP TABLE IF EXISTS fonts;`
    console.log("Dropped existing table (if any).")

    await sql`
      CREATE TABLE fonts (
        id SERIAL PRIMARY KEY,
        family VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(255),
        variants TEXT[],
        subsets TEXT[],
        version VARCHAR(50),
        last_modified DATE,
        files JSONB
      );
    `
    console.log('Table "fonts" created successfully with a unique constraint on family.')

    console.log(`Starting to insert all ${fonts.length} fonts... This may take a moment.`)

    // This loop now iterates over the FULL array of fonts
    for (const font of fonts) {
      await sql`
        INSERT INTO fonts (family, category, variants, subsets, version, last_modified, files)
        VALUES (${font.family}, ${font.category}, ${font.variants}, ${font.subsets}, ${font.version}, ${font.lastModified}, ${JSON.stringify(font.files)})
        ON CONFLICT (family) DO NOTHING;
      `
    }

    console.log(`Database seeding completed successfully! All ${fonts.length} fonts have been inserted.`)
  } catch (error) {
    console.error("An error occurred during database seeding:", error)
  }
}

seedDatabase()
