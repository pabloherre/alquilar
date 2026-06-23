import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

function formatAmountArs(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

function formatPeriod(year, month) {
  return `${String(month).padStart(2, '0')}/${year}`;
}

export function generateReceiptPdf({
  outputPath,
  receiptNumber,
  tenantName,
  contractTitle,
  year,
  month,
  amountUsd,
  generatedAt
}) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Recibo ${receiptNumber}` } });
    const stream = fs.createWriteStream(outputPath);

    const palette = {
      brand: '#0F766E',
      brandLight: '#E6FFFA',
      text: '#0F172A',
      muted: '#475569',
      line: '#CBD5E1'
    };

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;

    doc.pipe(stream);

    doc
      .save()
      .roundedRect(doc.page.margins.left, 30, contentWidth, 72, 8)
      .fillColor(palette.brandLight)
      .fill()
      .restore();

    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .fillColor(palette.brand)
      .text('RECIBO DE PAGO', doc.page.margins.left + 16, 48);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(palette.muted)
      .text('Comprobante de cobro de alquiler', doc.page.margins.left + 16, 76);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(palette.text)
      .text(`NRO ${receiptNumber}`, doc.page.margins.left, 54, { align: 'right', width: contentWidth - 16 });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(palette.muted)
      .text(`Emitido: ${generatedAt}`, doc.page.margins.left, 72, { align: 'right', width: contentWidth - 16 });

    const infoTop = 128;
    const blockHeight = 134;

    doc
      .save()
      .roundedRect(doc.page.margins.left, infoTop, contentWidth, blockHeight, 8)
      .lineWidth(1)
      .strokeColor(palette.line)
      .stroke()
      .restore();

    const labelX = doc.page.margins.left + 18;
    const valueX = labelX + 110;
    let rowY = infoTop + 20;

    const writeField = (label, value) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.muted).text(`${label}:`, labelX, rowY, { width: 105 });
      doc.font('Helvetica').fontSize(10.5).fillColor(palette.text).text(value || '-', valueX, rowY, { width: contentWidth - 145 });
      rowY += 24;
    };

    writeField('Inquilino', tenantName);
    writeField('Contrato', contractTitle);
    writeField('Periodo', formatPeriod(year, month));
    writeField('Moneda', 'Pesos argentinos (ARS)');

    const amountTop = infoTop + blockHeight + 20;

    doc
      .save()
      .roundedRect(doc.page.margins.left, amountTop, contentWidth, 76, 8)
      .fillColor('#F8FAFC')
      .fill()
      .restore();

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(palette.muted)
      .text('Monto abonado', doc.page.margins.left + 18, amountTop + 14);

    doc
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor(palette.brand)
      .text(formatAmountArs(amountUsd), doc.page.margins.left + 18, amountTop + 30);

    const summaryTop = amountTop + 98;

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(palette.text)
      .text('Detalle', doc.page.margins.left, summaryTop);

    const tableTop = summaryTop + 18;
    const col1 = doc.page.margins.left;
    const col2 = col1 + (contentWidth * 0.55);

    doc
      .moveTo(col1, tableTop)
      .lineTo(col1 + contentWidth, tableTop)
      .strokeColor(palette.line)
      .lineWidth(1)
      .stroke();

    doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.muted).text('Concepto', col1 + 6, tableTop + 8);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.muted).text('Importe', col2 + 6, tableTop + 8);

    const row1Y = tableTop + 28;
    doc.font('Helvetica').fontSize(10.5).fillColor(palette.text).text(`Alquiler ${formatPeriod(year, month)}`, col1 + 6, row1Y);
    doc.font('Helvetica').fontSize(10.5).fillColor(palette.text).text(formatAmountArs(amountUsd), col2 + 6, row1Y);

    doc
      .moveTo(col1, row1Y + 22)
      .lineTo(col1 + contentWidth, row1Y + 22)
      .strokeColor(palette.line)
      .lineWidth(1)
      .stroke();

    const signY = row1Y + 64;

    doc
      .moveTo(doc.page.margins.left, signY)
      .lineTo(doc.page.margins.left + 180, signY)
      .strokeColor(palette.line)
      .lineWidth(1)
      .stroke();

    doc.font('Helvetica').fontSize(9).fillColor(palette.muted).text('Firma y aclaracion', doc.page.margins.left, signY + 6);

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(palette.muted)
      .text('Este recibo certifica la percepcion del pago correspondiente al periodo indicado.', doc.page.margins.left, doc.page.height - 68, {
        width: contentWidth,
        align: 'center'
      });

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}
