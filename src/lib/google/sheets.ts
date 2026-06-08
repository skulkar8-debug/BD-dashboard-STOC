import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { PIPELINE_SHEET_ID, PIPELINE_TAB_NAME } from './config'
import { getAuthenticatedClient } from './oauth'

function quoteSheetTab(tab: string): string {
  const escaped = tab.replace(/'/g, "''")
  return `'${escaped}'`
}

export async function requireAuthenticatedClient(): Promise<OAuth2Client> {
  const client = await getAuthenticatedClient()
  if (!client) {
    const err = new Error('Not authenticated with Google') as Error & { status?: number }
    err.status = 401
    throw err
  }
  return client
}

export async function fetchSheetValues(
  auth: OAuth2Client,
  spreadsheetId: string,
  tabName: string,
  range = 'A:ZZ'
): Promise<string[][]> {
  const sheets = google.sheets({ version: 'v4', auth })
  const a1Range = `${quoteSheetTab(tabName)}!${range}`

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: a1Range,
    valueRenderOption: 'FORMATTED_VALUE',
  })

  return (res.data.values ?? []).map((row) =>
    row.map((cell) => String(cell ?? '').trim())
  )
}

async function getFirstSheetTitle(
  auth: OAuth2Client,
  spreadsheetId: string
): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth })
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  const title = meta.data.sheets?.[0]?.properties?.title
  if (!title) throw new Error('Spreadsheet has no tabs')
  return title
}

export async function fetchPipelineSheetValues(): Promise<string[][]> {
  const auth = await requireAuthenticatedClient()
  const tab =
    PIPELINE_TAB_NAME || (await getFirstSheetTitle(auth, PIPELINE_SHEET_ID))
  return fetchSheetValues(auth, PIPELINE_SHEET_ID, tab)
}

export async function fetchRoadmapTab(tabName: string): Promise<string[][]> {
  const auth = await requireAuthenticatedClient()
  const { ROADMAP_SHEET_ID } = await import('./config')
  return fetchSheetValues(auth, ROADMAP_SHEET_ID, tabName)
}

export async function updateSheetCells(
  auth: OAuth2Client,
  spreadsheetId: string,
  tabName: string,
  updates: { colIndex: number; rowIndex: number; value: string | boolean }[]
): Promise<void> {
  if (updates.length === 0) return

  const sheets = google.sheets({ version: 'v4', auth })
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map(({ colIndex, rowIndex, value }) => ({
        range: `${quoteSheetTab(tabName)}!${colToA1(colIndex)}${rowIndex + 1}`,
        values: [[value]],
      })),
    },
  })
}

function colToA1(colIndex: number): string {
  let n = colIndex + 1
  let letters = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}
