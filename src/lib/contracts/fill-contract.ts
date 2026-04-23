import { readFile } from "fs/promises";
import { join } from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const TEMPLATE_RELATIVE_PATH =
  "public/contracts/Student Enrollment Contract - template.pdf";

// Coordinates measured from the actual template (page 7, A4 596x842, origin bottom-left).
// The "FOR THE STUDENT" column labels sit at x=306.8; values sit ~15pt below the label.
const STUDENT_NAME_POSITION = { page: 6, x: 306.8, y: 647 };
const STUDENT_DATE_POSITION = { page: 6, x: 306.8, y: 606 };

export interface FillContractInput {
  name: string;
  /** ISO date or Date; defaults to now. */
  sentAt?: Date | string;
}

export async function fillContractPdf({
  name,
  sentAt,
}: FillContractInput): Promise<Uint8Array> {
  const templatePath = join(process.cwd(), TEMPLATE_RELATIVE_PATH);
  const bytes = await readFile(templatePath);

  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const page = pdf.getPage(STUDENT_NAME_POSITION.page);
  const black = rgb(0, 0, 0);
  const fontSize = 10.5;

  page.drawText(name, {
    x: STUDENT_NAME_POSITION.x,
    y: STUDENT_NAME_POSITION.y,
    size: fontSize,
    font,
    color: black,
  });

  page.drawText(formatDate(sentAt), {
    x: STUDENT_DATE_POSITION.x,
    y: STUDENT_DATE_POSITION.y,
    size: fontSize,
    font,
    color: black,
  });

  return pdf.save();
}

function formatDate(input?: Date | string): string {
  const d = input ? (typeof input === "string" ? new Date(input) : input) : new Date();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
