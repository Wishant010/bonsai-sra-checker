import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const ANONYMOUS_USER_ID = 'anonymous';

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: ANONYMOUS_USER_ID },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        originalName: true,
        size: true,
        pageCount: true,
        processed: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB || '50') || 50) * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    const filename = `${uuidv4()}.pdf`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const document = await prisma.document.create({
      data: {
        userId: ANONYMOUS_USER_ID,
        filename,
        originalName: file.name,
        pdfData: buffer,
        mimeType: 'application/pdf',
        size: file.size,
      },
    });

    return NextResponse.json({
      document: {
        id: document.id,
        filename: document.filename,
        originalName: document.originalName,
        size: document.size,
      },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
