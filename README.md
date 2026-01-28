# SRA Checker - Accountancy AI Tool

AI-powered tool to check Dutch annual reports (jaarrekeningen) against SRA checklist criteria.

## Features

- **PDF Upload & Processing**: Upload PDF annual reports with page-by-page text extraction
- **SRA Checklist Validation**: Check documents against SRA criteria (filtered for "i+d" enterprise type)
- **RAG-based Analysis**: Uses embeddings and retrieval to find relevant evidence in documents
- **AI-powered Evaluation**: GPT-4o-mini evaluates each criterion with PASS/FAIL/UNKNOWN status
- **Evidence & Page References**: Get exact quotes and page numbers for each finding
- **Async Processing**: Background job processing with real-time progress updates
- **Authentication**: Secure login/registration with BetterAuth
- **Dark Theme UI**: Clean, modern dark theme interface

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: BetterAuth
- **AI/LLM**: OpenAI (GPT-4o-mini for evaluation, text-embedding-3-small for embeddings)
- **PDF Parsing**: pdf-parse
- **Excel Parsing**: xlsx
- **Styling**: Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- OpenAI API key (for full functionality)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Wishant010/bonsai-sra-checker.git
cd bonsai-sra-checker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=sk-your-actual-api-key
BETTER_AUTH_SECRET=generate-a-random-32-char-string
```

4. Initialize the database:
```bash
npx prisma migrate dev
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Demo with Included Files

The repository includes test files for immediate demo:

- `data/voorbeeldjaarrekening-gemeenten-2023.pdf` - Example Dutch annual report
- `data/SRA-checklist.xlsm` - SRA checklist (with sample data fallback)

### Running the Demo

1. Start the app and register/login
2. On the dashboard, click **"Run Demo with Example PDF"**
3. The system will:
   - Load the example PDF from `data/`
   - Extract text and generate embeddings
   - Load the sample checklist (20 items for "i+d" enterprises)
   - Run AI evaluation on each criterion
4. View results with PASS/FAIL/UNKNOWN status, reasoning, and evidence

**Note**: Without an OPENAI_API_KEY, the demo will set up the document and checklist but cannot run the AI evaluation.

## Project Structure

```
bonsai-sra-checker/
├── data/                    # Test data files (PDF, Excel)
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── src/
│   ├── app/
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # BetterAuth endpoints
│   │   │   ├── checks/     # Check run management
│   │   │   ├── checklist/  # Checklist management
│   │   │   ├── demo/       # Demo endpoint
│   │   │   └── documents/  # Document upload/processing
│   │   ├── (auth)/         # Auth pages (login, register)
│   │   ├── (protected)/    # Protected pages (dashboard, results)
│   │   └── page.tsx        # Landing page
│   ├── components/
│   │   ├── auth/           # Auth form components
│   │   ├── dashboard/      # Dashboard components
│   │   ├── layout/         # Layout components (header)
│   │   └── ui/             # UI components (button, card, etc.)
│   └── lib/
│       ├── auth.ts         # BetterAuth configuration
│       ├── auth-client.ts  # Auth client for frontend
│       ├── checklist-parser.ts  # Excel/checklist parsing
│       ├── embeddings.ts   # Embedding generation & retrieval
│       ├── job-queue.ts    # Async job processing
│       ├── llm.ts          # LLM evaluation
│       ├── pdf-parser.ts   # PDF text extraction
│       └── prisma.ts       # Prisma client
├── uploads/                # Uploaded PDF storage
├── .env.example           # Environment template
└── README.md
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite database path | Yes |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and LLM | Yes* |
| `BETTER_AUTH_SECRET` | Secret for session encryption | Yes |
| `BETTER_AUTH_URL` | Base URL for auth | Yes |
| `NEXT_PUBLIC_APP_URL` | Public app URL | Yes |
| `UPLOAD_DIR` | Directory for uploaded files | No |
| `MAX_FILE_SIZE_MB` | Maximum upload size in MB | No |

*Required for AI-powered checks; app runs without it but with limited functionality.

## API Endpoints

### Authentication
- `POST /api/auth/sign-up` - Register new user
- `POST /api/auth/sign-in` - Login
- `POST /api/auth/sign-out` - Logout

### Documents
- `GET /api/documents` - List user's documents
- `POST /api/documents` - Upload new document
- `POST /api/documents/[id]/process` - Process document (extract text, generate embeddings)

### Checklist
- `GET /api/checklist` - Get available checklist sheets
- `POST /api/checklist` - Seed checklist data

### Checks
- `GET /api/checks` - List user's check runs
- `POST /api/checks` - Start new check run
- `GET /api/checks/[id]` - Get check run with results

### Demo
- `POST /api/demo` - Run demo with included test files

## User Flow

1. **Register/Login**: Create account or sign in
2. **Dashboard**: Upload PDF or use demo
3. **Process**: Document is parsed and embedded
4. **Select Checklist**: Choose which checklist sheet to validate
5. **Run Checks**: Background job evaluates each criterion
6. **View Results**: See PASS/FAIL/UNKNOWN with evidence

## How It Works

### PDF Processing
1. PDF is uploaded and stored
2. Text is extracted page-by-page using pdf-parse
3. Text is chunked (800-1200 chars) while preserving page references
4. Each chunk is embedded using OpenAI text-embedding-3-small
5. Embeddings are stored in the database

### RAG Evaluation
For each checklist criterion:
1. Generate embedding for the criterion text
2. Retrieve top-5 most similar chunks from the document
3. Send criterion + context to GPT-4o-mini
4. LLM returns JSON with status, reasoning, evidence, confidence
5. Results are stored and displayed

### Checklist Filtering
- The Excel checklist is parsed with xlsx
- Only rows applicable to "i+d" enterprise type are included
- Sample data is used as fallback if Excel parsing fails

## Development

### Database Commands
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio
```

### Build for Production
```bash
npm run build
npm start
```

## MVP Limitations

- Single checklist sheet support (extensible architecture)
- In-memory job queue (can be replaced with Redis/BullMQ)
- Local file storage (can be replaced with S3/GCS)
- No email verification (disabled for MVP)

## License

MIT
