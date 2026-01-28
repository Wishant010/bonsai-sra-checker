import fs from 'fs';
import path from 'path';

export interface ChecklistItem {
  checkId: string;
  checkText: string;
  category?: string;
  wettelijkeBasis?: string;
  applicableTypes: string[];
  order: number;
}

export interface ChecklistSheet {
  sheetName: string;
  items: ChecklistItem[];
}

export interface FullChecklist {
  metadata: {
    description: string;
    type: string;
    typeDescription: string;
  };
  sheets: ChecklistSheet[];
  totalChecks: number;
}

/**
 * Load the SRA checklist from the JSON file
 * This contains all i+d applicable checks
 */
export function loadChecklistFromJSON(): FullChecklist {
  const jsonPath = path.join(process.cwd(), 'data', 'sra-checklist-id.json');

  try {
    if (!fs.existsSync(jsonPath)) {
      console.warn(`Checklist JSON not found at: ${jsonPath}, using fallback`);
      return getFallbackChecklist();
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(jsonContent);

    // Transform the data into our format
    const sheets: ChecklistSheet[] = data.sheets.map((sheet: {
      sheetName: string;
      items: Array<{
        checkId: string;
        checkText: string;
        category?: string;
        wettelijkeBasis?: string;
      }>;
    }, sheetIndex: number) => ({
      sheetName: sheet.sheetName,
      items: sheet.items.map((item, itemIndex: number) => ({
        checkId: item.checkId,
        checkText: item.checkText,
        category: item.category,
        wettelijkeBasis: item.wettelijkeBasis,
        applicableTypes: ['i+d'],
        order: sheetIndex * 100 + itemIndex + 1,
      })),
    }));

    return {
      metadata: data.metadata,
      sheets,
      totalChecks: data.totalChecks,
    };
  } catch (error) {
    console.error('Error loading checklist JSON:', error);
    return getFallbackChecklist();
  }
}

/**
 * Get a specific sheet from the checklist
 */
export function getChecklistSheet(sheetName?: string): ChecklistSheet {
  const fullChecklist = loadChecklistFromJSON();

  if (!sheetName) {
    // Return first sheet by default
    return fullChecklist.sheets[0];
  }

  const sheet = fullChecklist.sheets.find(
    (s) => s.sheetName.toLowerCase() === sheetName.toLowerCase()
  );

  if (!sheet) {
    console.warn(`Sheet "${sheetName}" not found, returning first sheet`);
    return fullChecklist.sheets[0];
  }

  return sheet;
}

/**
 * Get all available sheet names
 */
export function getAvailableSheets(): string[] {
  const fullChecklist = loadChecklistFromJSON();
  return fullChecklist.sheets.map((s) => s.sheetName);
}

/**
 * Get all checks across all sheets (for comprehensive check)
 */
export function getAllChecks(): ChecklistItem[] {
  const fullChecklist = loadChecklistFromJSON();
  return fullChecklist.sheets.flatMap((sheet) => sheet.items);
}

/**
 * Fallback checklist if JSON file is not available
 */
function getFallbackChecklist(): FullChecklist {
  return {
    metadata: {
      description: 'Fallback SRA Checklist',
      type: 'i+d',
      typeDescription: 'i = Inrichtingsjaarrekening, d = Deponeringsjaarrekening',
    },
    sheets: [
      {
        sheetName: 'Balans',
        items: [
          {
            checkId: 'BAL-001',
            checkText: 'De balans bevat een overzicht van de activa en passiva per balansdatum.',
            category: 'Balans - Algemeen',
            applicableTypes: ['i+d'],
            order: 1,
          },
          {
            checkId: 'BAL-002',
            checkText: 'De vaste activa zijn onderverdeeld in immateriële, materiële en financiële vaste activa.',
            category: 'Balans - Activa',
            applicableTypes: ['i+d'],
            order: 2,
          },
          {
            checkId: 'BAL-003',
            checkText: 'De vlottende activa omvatten voorraden, vorderingen, effecten en liquide middelen.',
            category: 'Balans - Activa',
            applicableTypes: ['i+d'],
            order: 3,
          },
          {
            checkId: 'BAL-004',
            checkText: 'Het eigen vermogen is duidelijk weergegeven met toelichting op reserves.',
            category: 'Balans - Passiva',
            applicableTypes: ['i+d'],
            order: 4,
          },
          {
            checkId: 'BAL-005',
            checkText: 'De voorzieningen zijn afzonderlijk vermeld met toelichting op aard en omvang.',
            category: 'Balans - Passiva',
            applicableTypes: ['i+d'],
            order: 5,
          },
        ],
      },
    ],
    totalChecks: 5,
  };
}

// Legacy function for backward compatibility
export async function parseChecklistExcel(
  filePath: string,
  sheetName?: string
): Promise<ChecklistSheet> {
  console.log(`parseChecklistExcel called with path: ${filePath}, sheet: ${sheetName}`);
  console.log('Using JSON-based checklist instead of Excel parsing');
  return getChecklistSheet(sheetName);
}

// Legacy function for backward compatibility
export function getSampleChecklist(): ChecklistSheet {
  return getChecklistSheet('Balans');
}

// Legacy function for backward compatibility
export function getExcelSheetNames(filePath: string): string[] {
  console.log(`getExcelSheetNames called with path: ${filePath}`);
  return getAvailableSheets();
}
