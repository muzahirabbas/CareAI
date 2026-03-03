import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Define the workerSrc for PDF.js to function properly in Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extracts raw text from a given image or PDF file.
 * Automatically determines file type and applies appropriate engine.
 */
export async function extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;

    if (fileType.includes('pdf')) {
        return extractTextFromPDF(file);
    } else if (fileType.startsWith('image/')) {
        return extractTextFromImage(file);
    } else {
        throw new Error('Unsupported file type. Please upload a PDF or an Image.');
    }
}

async function extractTextFromImage(file: File): Promise<string> {
    try {
        const imageUrl = URL.createObjectURL(file);
        const result = await Tesseract.recognize(imageUrl, 'eng');
        URL.revokeObjectURL(imageUrl);
        return result.data.text;
    } catch (error) {
        console.error("Image OCR Failed:", error);
        throw new Error("Failed to extract text from image.");
    }
}

async function extractTextFromPDF(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(" ");
            fullText += pageText + "\n";
        }

        return fullText;
    } catch (error) {
        console.error("PDF Parsing Failed:", error);
        throw new Error("Failed to parse text from PDF.");
    }
}
