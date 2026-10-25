import PDFDocument from 'pdfkit';

export const PDF_COLORS = {
  primary: '#5B5CE2',
  primaryDark: '#34358F',
  dark: '#18181F',
  textSecondary: '#6B6B78',
  textMuted: '#9494A3',
  lightBg: '#F8F9FC',
  cardBg: '#FFFFFF',
  borderSubtle: '#E8E8EF',
  borderAccent: '#D6DAFF',
  brandPurpleLight: '#EEF0FF',
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  info: '#3B82F6',
  infoBg: '#EFF6FF'
};

export interface StatCardItem {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
}

export function drawHeaderBanner(
  doc: InstanceType<typeof PDFDocument>,
  options: {
    title: string;
    subtitle: string;
    kicker?: string;
    metaLines?: { label: string; value: string }[];
  }
): void {
  const pageWidth = doc.page.width;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // Top accent bar
  doc
    .save()
    .rect(0, 0, pageWidth, 6)
    .fill(PDF_COLORS.primary);

  // Brand Name
  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor(PDF_COLORS.primary)
    .text('EVALORA', margin, 24, { continued: false });

  // Document Title
  if (options.kicker) {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(PDF_COLORS.primaryDark)
      .text(options.kicker.toUpperCase(), margin, 52, { characterSpacing: 1 });
  }

  doc
    .fontSize(18)
    .font('Helvetica-Bold')
    .fillColor(PDF_COLORS.dark)
    .text(options.title, margin, options.kicker ? 66 : 52);

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(PDF_COLORS.textSecondary)
    .text(options.subtitle, margin, options.kicker ? 88 : 74);

  // Metadata block on right side
  if (options.metaLines && options.metaLines.length > 0) {
    const labelWidth = 70;
    const valWidth = 140;
    const totalBlockWidth = labelWidth + valWidth;
    const metaX = pageWidth - margin - totalBlockWidth;
    let metaY = 24;

    for (const item of options.metaLines) {
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(PDF_COLORS.textSecondary)
        .text(`${item.label}:`, metaX, metaY, {
          width: labelWidth,
          align: 'right'
        });

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(PDF_COLORS.dark)
        .text(item.value, metaX + labelWidth + 6, metaY, {
          width: valWidth - 6,
          align: 'left'
        });

      metaY += 14;
    }
  }

  // Divider
  const dividerY = options.kicker ? 106 : 94;
  doc
    .strokeColor(PDF_COLORS.borderSubtle)
    .lineWidth(1)
    .moveTo(margin, dividerY)
    .lineTo(pageWidth - margin, dividerY)
    .stroke()
    .restore();

  doc.y = dividerY + 14;
}

export function drawSectionHeading(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  subtitle?: string
): void {
  const margin = 40;
  doc.moveDown(0.6);
  const currentY = doc.y;

  // Left accent pill
  doc
    .save()
    .roundedRect(margin, currentY, 3, 14, 1.5)
    .fill(PDF_COLORS.primary);

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(PDF_COLORS.dark)
    .text(title, margin + 10, currentY);

  if (subtitle) {
    doc
      .fontSize(8.5)
      .font('Helvetica')
      .fillColor(PDF_COLORS.textSecondary)
      .text(subtitle, margin + 10, currentY + 15);
    doc.y = currentY + 28;
  } else {
    doc.y = currentY + 18;
  }
  doc.restore();
}

export function drawStatCards(
  doc: InstanceType<typeof PDFDocument>,
  cards: StatCardItem[]
): void {
  const margin = 40;
  const contentWidth = doc.page.width - margin * 2;
  const gap = 8;
  const cardWidth = (contentWidth - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 58;
  const startY = doc.y;

  doc.save();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const x = margin + i * (cardWidth + gap);

    // Background & border
    doc
      .roundedRect(x, startY, cardWidth, cardHeight, 6)
      .fillAndStroke(PDF_COLORS.lightBg, PDF_COLORS.borderSubtle);

    // Label
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(PDF_COLORS.textSecondary)
      .text(card.label.toUpperCase(), x + 8, startY + 8, {
        width: cardWidth - 16,
        align: 'left',
        characterSpacing: 0.5
      });

    // Value
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor(card.color || PDF_COLORS.dark)
      .text(String(card.value), x + 8, startY + 22, {
        width: cardWidth - 16,
        align: 'left'
      });

    // Sublabel
    if (card.sublabel) {
      doc
        .fontSize(7.5)
        .font('Helvetica')
        .fillColor(PDF_COLORS.textMuted)
        .text(card.sublabel, x + 8, startY + 42, {
          width: cardWidth - 16,
          align: 'left'
        });
    }
  }
  doc.restore();
  doc.y = startY + cardHeight + 10;
}

export function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  columns: { title: string; key: string; width: number; align?: 'left' | 'center' | 'right' }[],
  data: Record<string, any>[],
  options?: { highlightFirstCol?: boolean }
): void {
  const margin = 40;
  const startY = doc.y;
  const rowHeight = 22;
  const totalWidth = columns.reduce((acc, c) => acc + c.width, 0);

  doc.save();

  // Header row
  doc
    .roundedRect(margin, startY, totalWidth, rowHeight, 4)
    .fill(PDF_COLORS.brandPurpleLight);

  let currentX = margin;
  for (const col of columns) {
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .fillColor(PDF_COLORS.primaryDark)
      .text(col.title.toUpperCase(), currentX + 6, startY + 6, {
        width: col.width - 12,
        align: col.align || 'left',
        characterSpacing: 0.5
      });
    currentX += col.width;
  }

  let y = startY + rowHeight;

  // Data rows
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const isEven = r % 2 === 0;

    // Background
    if (isEven) {
      doc
        .rect(margin, y, totalWidth, rowHeight)
        .fill(PDF_COLORS.lightBg);
    }

    currentX = margin;
    for (const col of columns) {
      const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-';
      const isFirst = col === columns[0] && options?.highlightFirstCol;

      doc
        .fontSize(8.5)
        .font(isFirst ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(isFirst ? PDF_COLORS.dark : PDF_COLORS.textSecondary)
        .text(val, currentX + 6, y + 6, {
          width: col.width - 12,
          align: col.align || 'left'
        });
      currentX += col.width;
    }

    // Row bottom border
    doc
      .strokeColor(PDF_COLORS.borderSubtle)
      .lineWidth(0.5)
      .moveTo(margin, y + rowHeight)
      .lineTo(margin + totalWidth, y + rowHeight)
      .stroke();

    y += rowHeight;

    // Check if new page needed
    if (y > doc.page.height - 60 && r < data.length - 1) {
      doc.addPage();
      y = 40;
    }
  }

  doc.restore();
  doc.y = y + 8;
}

export function drawPageFooters(
  doc: InstanceType<typeof PDFDocument>,
  options: { documentId: string; documentType: string }
): void {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const pageBottom = doc.page.height - 28;
    const margin = 40;
    const pageWidth = doc.page.width;

    doc.save();

    // Top border of footer
    doc
      .strokeColor(PDF_COLORS.borderSubtle)
      .lineWidth(0.5)
      .moveTo(margin, pageBottom - 8)
      .lineTo(pageWidth - margin, pageBottom - 8)
      .stroke();

    // Left info
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor(PDF_COLORS.textMuted)
      .text(
        `Generated by Evalora Assessment Platform  •  ${options.documentType} ID: ${options.documentId}  •  ${new Date().toLocaleDateString()}`,
        margin,
        pageBottom,
        { width: 360, align: 'left' }
      );

    // Right info: page number
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(PDF_COLORS.textSecondary)
      .text(`Page ${i + 1} of ${totalPages}`, pageWidth - margin - 100, pageBottom, {
        width: 100,
        align: 'right'
      });

    doc.restore();
  }
}
