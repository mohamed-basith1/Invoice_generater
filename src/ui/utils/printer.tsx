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

export const generateInvoicePDF = (items, totalAmount, fulldata, layoutMode = "new") => {
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
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(fulldata.format, 14, 68);

  // Metadata Grid
  doc.setFontSize(9);
  
  const printMeta = (label, value, xLabel, xVal, y) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(label, xLabel, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(value || "-", xVal, y);
  };

  const isInvoice = fulldata.format === "INVOICE";
  printMeta(isInvoice ? "Invoice No:" : "Quotation No:", fulldata.invoiceNumber, 14, 42, 78);
  printMeta("Customer:", capitalizeWords(fulldata.customerName), 14, 42, 84);
  printMeta("Project Name:", fulldata.projectName, 14, 42, 90);
  printMeta("Reference No:", fulldata.referenceNumber, 14, 42, 96);
  printMeta("Invoice Type:", fulldata.invoiceType, 14, 42, 102);

  // Right column metadata
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Date:", 145, 78);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(formatDateToReadable(fulldata.date), 195, 78, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Shop:", 145, 84);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(fulldata.shop, 195, 84, { align: "right" });

  // Table Headers
  const headers = layoutMode === "old"
    ? [[
        "S.NO",
        "DESCRIPTION",
        "QTY",
        "RATE",
        "AMOUNT"
      ]]
    : [[
        "S.NO",
        "DESCRIPTION",
        "THICKNESS",
        "SIZE",
        "UNIT",
        "AREA",
        "TYPE",
        "QTY",
        "RATE",
        "AMOUNT"
      ]];

  // Table Rows
  const rows = items.map((item) => {
    if (layoutMode === "old") {
      return [
        item.sNo,
        item.description,
        item.quantity ? item.quantity : "-",
        {
          content: (item.rate !== undefined ? item.rate : (item.price || 0)).toLocaleString("en-IN", {
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
      ];
    } else {
      return [
        item.sNo,
        item.description,
        item.boardThickness || "-",
        item.size || "-",
        item.unit || "-",
        item.area ? item.area : "-",
        item.type || "-",
        item.quantity ? item.quantity : "-",
        {
          content: (item.rate !== undefined ? item.rate : (item.price || 0)).toLocaleString("en-IN", {
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
      ];
    }
  });

  const startY = 110;
  const firstPageMaxHeight = 140;
  const approximateRowHeight = 10;

  // Calculate how many rows fit on the first page
  const rowsOnFirstPage = Math.floor(firstPageMaxHeight / approximateRowHeight);
  const firstPageRows = rows.slice(0, rowsOnFirstPage);
  const remainingRows = rows.slice(rowsOnFirstPage);

  const tableStyles = {
    head: headers,
    theme: "grid",
    styles: { fontSize: 7 },
    headStyles: {
      fontSize: 7,
      fillColor: [30, 30, 45],
      textColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18 },
      3: { cellWidth: 15 },
      4: { cellWidth: 14 },
      5: { cellWidth: 14 },
      6: { cellWidth: 14 },
      7: { cellWidth: 12 },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 20, halign: "right" },
    },
  };

  // First page table
  doc.autoTable({
    ...tableStyles,
    body: firstPageRows,
    startY: startY,
  });

  // Add remaining rows to new pages (if any)
  if (remainingRows.length > 0) {
    doc.addPage();
    doc.autoTable({
      ...tableStyles,
      body: remainingRows,
      startY: 20,
    });
  }

  // Summary Section (on the last page)
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(`Total`, 170, finalY, { align: "right" });
  doc.text(
    `${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    195,
    finalY,
    { align: "right" }
  );

  // Render bank details / quotation disclaimer on the first page to align with background templates
  doc.setPage(1);

  doc.setFont("helvetica", "normal");
  if (fulldata.format !== "INVOICE") {
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(13);
    doc.text("INSTALLATION AND TRANSPORT CHARGES ARE EXTRA", 176, 260, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text("THANK YOU FOR YOUR BUSINESS!", 139, 270, {
      align: "right",
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
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
