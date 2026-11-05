import PDFDocument from "pdfkit";
import {
  quoteTotals,
  quoteContentSchema,
  type QuoteContent,
} from "../../shared/operations";
import { money } from "../../shared/mds";

const printable = (text: string) =>
  text
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
export async function renderQuotePdf(input: {
  reference: string;
  createdAt: Date;
  content: QuoteContent;
}): Promise<Buffer> {
  const content = quoteContentSchema.parse(input.content);
  const totals = quoteTotals(content.lines);
  const pdf = new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: true,
    info: {
      Title: `Devis ${input.reference}`,
      Author: content.issuerName,
      Subject: content.title,
      CreationDate: input.createdAt,
    },
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", chunk => chunks.push(Buffer.from(chunk)));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  const heading = (text: string) => {
    if (pdf.y > 720) pdf.addPage();
    pdf
      .moveDown(0.6)
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#222222")
      .text(printable(text));
    pdf.moveDown(0.3);
  };
  const text = (value: string) =>
    pdf
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#333333")
      .text(printable(value), { lineGap: 3 });
  const euro = (cents: number) => printable(money(cents));
  pdf.font("Helvetica-Bold").fontSize(28).fillColor("#BC4C23").text("DEVIS");
  text(
    `Référence : ${input.reference}\nDate : ${input.createdAt.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}\nValable jusqu’au : ${content.validUntil.split("-").reverse().join("/")}`
  );
  heading("Émetteur");
  text(
    `${content.issuerName}\n${content.issuerAddress}\nImmatriculation : ${content.issuerRegistration}\n${content.issuerEmail} | ${content.issuerPhone}`
  );
  heading("Destinataire et lieu des travaux");
  text(`${content.clientName}\n${content.clientAddress}`);
  heading(content.title);
  for (const [index, line] of content.lines.entries()) {
    const amount = quoteTotals([line]);
    if (pdf.y > 710) pdf.addPage();
    pdf
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(printable(`${index + 1}. ${line.label}`), { lineGap: 3 });
    text(
      `Quantité : ${line.quantity} | Prix unitaire HT : ${euro(line.unitCents)} | TVA : ${(line.vatBasisPoints / 100).toLocaleString("fr-FR")}%\nMontant HT : ${euro(amount.netCents)} | TVA : ${euro(amount.vatCents)} | TTC : ${euro(amount.totalCents)}`
    );
    pdf.moveDown(0.5);
  }
  heading("Montants");
  text(
    `Total HT : ${euro(totals.netCents)}\nTVA : ${euro(totals.vatCents)}\nTotal TTC : ${euro(totals.totalCents)}\nAcompte indiqué : ${euro(content.depositCents)}`
  );
  heading("Traitement fiscal déclaré par l’émetteur");
  text(content.taxNote);
  heading("Compris dans la prestation");
  text(content.included);
  heading("Non compris");
  text(content.excluded);
  heading("Conditions d’intervention");
  text(content.conditions);
  heading("Modalités de paiement");
  text(content.paymentTerms);
  heading("Assurance déclarée par l’émetteur");
  text(content.insuranceNote);
  heading("Validation");
  text(
    "L’accord client sur ce devis sera enregistré dans le suivi privé. Il reste distinct de la confirmation du rendez-vous. Les informations fiscales, d’immatriculation et d’assurance ci-dessus sont celles renseignées par l’émetteur ; le document n’atteste pas leur vérification juridique."
  );
  const range = pdf.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    pdf.switchToPage(page);
    pdf
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#666666")
      .text(
        printable(`${input.reference} | Page ${page + 1}/${range.count}`),
        48,
        800,
        { lineBreak: false, width: 500 }
      );
  }
  pdf.end();
  return completed;
}
