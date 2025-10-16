import { jsPDF } from 'jspdf';

export type ScoreReportInput = {
  conversationId: string;
  score: number;
  feedback: string;
  transcript?: string | null;
  generatedAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) {
    return new Date().toLocaleString('de-DE');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('de-DE');
}

export function createMarkdownReport(data: ScoreReportInput) {
  const createdAt = formatDate(data.generatedAt);
  const transcriptSection = data.transcript
    ? `\n\n## Transkript\n\n\`\`\`\n${data.transcript}\n\`\`\``
    : '';

  return `# Score Report\n\n**Gespräch-ID:** ${data.conversationId}\n\n**Score:** ${data.score}\n\n**Feedback**\n\n${data.feedback}${transcriptSection}\n\n_Erstellt am ${createdAt}_\n`;
}

export function downloadMarkdownReport(data: ScoreReportInput, filename = 'score-report.md') {
  const content = createMarkdownReport(data);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPdfReport(data: ScoreReportInput, filename = 'score-report.pdf') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;

  doc.setFontSize(18);
  doc.text('Score Report', margin, y);
  y += 30;

  doc.setFontSize(12);
  const metaLines = [
    `Gespräch-ID: ${data.conversationId}`,
    `Score: ${data.score}`,
    `Erstellt: ${formatDate(data.generatedAt)}`
  ];

  metaLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 18;
  });

  y += 6;
  doc.setFontSize(14);
  doc.text('Feedback', margin, y);
  y += 20;

  doc.setFontSize(12);
  const feedbackLines = doc.splitTextToSize(data.feedback, 515 - margin);
  feedbackLines.forEach((line) => {
    if (y > 770) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 16;
  });

  if (data.transcript) {
    y += 12;
    doc.setFontSize(14);
    doc.text('Transkript', margin, y);
    y += 20;

    doc.setFontSize(11);
    const transcriptLines = doc.splitTextToSize(data.transcript, 515 - margin);

    transcriptLines.forEach((line) => {
      if (y > 770) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 14;
    });
  }

  doc.save(filename);
}
