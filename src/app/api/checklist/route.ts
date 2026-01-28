import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { loadChecklistFromJSON } from '@/lib/checklist-parser';

export async function GET() {
  try {
    // Load checklist from JSON file (no auth required)
    const fullChecklist = loadChecklistFromJSON();

    // Return sheets with item counts
    return NextResponse.json({
      sheets: fullChecklist.sheets.map((sheet) => ({
        name: sheet.sheetName,
        itemCount: sheet.items.length,
      })),
      metadata: fullChecklist.metadata,
      totalChecks: fullChecklist.totalChecks,
    });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Load full checklist from JSON
    const fullChecklist = loadChecklistFromJSON();

    let totalSeeded = 0;

    // Seed all sheets
    for (const sheet of fullChecklist.sheets) {
      // Check if already seeded
      const existing = await prisma.checklistItem.count({
        where: { sheetName: sheet.sheetName },
      });

      if (existing === 0) {
        // Seed checklist items for this sheet
        await prisma.$transaction(
          sheet.items.map((item) =>
            prisma.checklistItem.create({
              data: {
                sheetName: sheet.sheetName,
                checkId: item.checkId,
                checkText: item.checkText,
                category: item.category,
                wettelijkeBasis: item.wettelijkeBasis,
                applicableTypes: JSON.stringify(item.applicableTypes),
                order: item.order,
              },
            })
          )
        );
        totalSeeded += sheet.items.length;
      }
    }

    return NextResponse.json({
      message: totalSeeded > 0 ? 'Checklist loaded successfully' : 'Checklist already loaded',
      totalSheets: fullChecklist.sheets.length,
      totalItems: fullChecklist.totalChecks,
      newItemsSeeded: totalSeeded,
    });
  } catch (error) {
    console.error('Error loading checklist:', error);
    return NextResponse.json(
      { error: 'Failed to load checklist' },
      { status: 500 }
    );
  }
}
