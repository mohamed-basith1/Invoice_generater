import jsPDF from "jspdf";
import "jspdf-autotable";
import { backgroundImage as szImage } from "./szSignageImage";
import { backgroundImage as stickerZoneImage } from "./stickerZoneImage";
import { backgroundImage as szImageQuotation } from "./szSignageImageQuotation";
import { backgroundImage as stickerZoneImageQuotation } from "./stickerZoneImageQuotation";

function capitalizeWords(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateToReadable(isoDateStr) {
  const date = new Date(isoDateStr);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  const year = date.getUTCFullYear();
  return `${day} ${month}, ${year}`;
}

export const generateInvoicePDF = (items, totalAmount, fulldata) => {
  const doc = new jsPDF();

  doc.addImage(
    fulldata.format === "INVOICE"
      ? fulldata.shop === "SZ SIGNAGE"
        ? szImage
        : stickerZoneImage
      : fulldata.shop === "SZ SIGNAGE"
      ? szImageQuotation
      : stickerZoneImageQuotation,
    "PNG",
    0,
    0,
    210,
    297
  );
  // Company Header
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(fulldata.shop, fulldata.shop === "SZ SIGNAGE" ? 28 : 37, 22, {
    align: "left",
  });
  doc.setFontSize(10);

  doc.text(
    "THE COMPLETE SOLUTION",
    fulldata.shop === "SZ SIGNAGE" ? 28 : 37,
    27,
    {
      align: "left",
    }
  );

  //   doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);

  doc.text(
    "AYYAMPET,THANJAVUR - 614201",
    fulldata.shop === "SZ SIGNAGE" ? 28 : 37,
    32.5,
    {
      align: "left",
    }
  );
  doc.text(
    "Tel: +91 9790343367",
    fulldata.shop === "SZ SIGNAGE" ? 28 : 37,
    37,
    { align: "left" }
  );

  // Invoice Title & Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(40);
  doc.text(fulldata.format, 14, 70);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(
    fulldata.format === "INVOICE" ? `Invoice No : ` : `Quotation to : `,
    14,
    82
  );
  doc.setTextColor(177, 177, 177);
  doc.text(
    fulldata.format === "INVOICE"
      ? `${fulldata.invoiceNumber}`
      : `${fulldata.customerName}`,
    38,
    82
  );

  if (fulldata.format === "INVOICE") {
    doc.setTextColor(0, 0, 0);
    doc.text("Bill To :", 14, 90);
    doc.setTextColor(177, 177, 177);
    doc.text(`${capitalizeWords(fulldata.customerName)}`, 38, 90);
  }

  doc.setTextColor(0, 0, 0);
  doc.text(`Date : `, 165, 82, { align: "right" });
  doc.setTextColor(177, 177, 177);
  doc.text(`${formatDateToReadable(fulldata.date)}`, 195, 82, {
    align: "right",
  });

  // Table Headers
  const headers = [["S.NO", "DESCRIPTION", "QUANTITY", "PRICE", "AMOUNT"]];

  // Table Rows
  const rows = items.map((item) => [
    item.sNo,
    item.description,
    item.quantity,
    {
      content: item.price.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
      }),
      styles: { halign: "right" },
    },
    {
      content: item.amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
      }),
      styles: { halign: "right" },
    },
  ]);

  // Max height for the first page (e.g., 150mm from startY)
  const startY = 120;
  const firstPageMaxHeight = 150;
  const approximateRowHeight = 10; // Adjust based on your content

  // Calculate how many rows fit on the first page
  const rowsOnFirstPage = Math.floor(firstPageMaxHeight / approximateRowHeight);
  const firstPageRows = rows.slice(0, rowsOnFirstPage);
  const remainingRows = rows.slice(rowsOnFirstPage);

  // First page table (with height restriction)
  doc.autoTable({
    head: headers,
    body: firstPageRows,
    startY: startY,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: {
      fontSize: 8,
      fillColor: [229, 229, 229],
      textColor: [0, 0, 0],
    },
    columnStyles: {
      3: { halign: "right" }, // PRICE
      4: { halign: "right" }, // AMOUNT
    },
  });

  // Add remaining rows to new pages (if any)
  if (remainingRows.length > 0) {
    doc.addPage();
    doc.autoTable({
      head: headers,
      body: remainingRows,
      startY: 20, // Start lower on subsequent pages
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: {
        fontSize: 8,
        fillColor: [229, 229, 229],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        3: { halign: "right" }, // PRICE
        4: { halign: "right" }, // AMOUNT
      },
    });
  }

  // Summary Section (on the last page)
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setTextColor(0, 0, 0);
  doc.text(`Total`, 170, finalY, { align: "right" });
  doc.text(
    `${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    195,
    finalY,
    { align: "right" }
  );

  if (fulldata.format !== "INVOICE") {
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(15);
    doc.text("INSTALLATION AND TRANSPORT CHARGES ARE EXTRA", 176, 260, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text("THANK YOU FOR YOUR BUSINESS!", 139, 270, {
      align: "right",
    });
  }
  if (fulldata.format === "INVOICE") {
    doc.text("A/C NAME      :  UBAIYATHUL JIBRI", 11.5, 258, {
      align: "left",
    });
    doc.text("BANK NAME  :  ICICI BANK", 11.5, 264, {
      align: "left",
    });
    doc.text("A/C NO           :  000101628687", 11.5, 270, {
      align: "left",
    });
    doc.text("IFSC NO         :  ICIC0000001", 11.5, 276, {
      align: "left",
    });
  }

  // Save the PDF
  doc.save(`${fulldata.shop}_${fulldata.format}.pdf`);
};
