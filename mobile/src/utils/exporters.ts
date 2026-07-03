import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { documentDirectory, moveAsync, downloadAsync } from "expo-file-system/legacy";
import { Alert } from "react-native";
import dayjs from "dayjs";
import { StoredInvoice } from "../types";
import { API_URL } from "../config";

// Import local base64 templates
import { backgroundImage as szImage } from "./szSignageImage";
import { backgroundImage as stickerZoneImage } from "./stickerZoneImage";
import { backgroundImage as szImageQuotation } from "./szSignageImageQuotation";
import { backgroundImage as stickerZoneImageQuotation } from "./stickerZoneImageQuotation";

// Helper to format currency values
const formatCurrency = (val: number) => {
  return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ==========================================
// 1. PDF EXPORTER (EXPO-PRINT HTML)
// ==========================================
export const exportInvoicePDF = async (invoice: StoredInvoice) => {
  try {
    const isOldLayout = invoice.projectName === undefined || invoice.rows.some(r => r.boardThickness === undefined);
    
    // Construct HTML items table rows
    const rowsHtml = invoice.rows
      .map((row) => {
        if (isOldLayout) {
          return `
            <tr>
              <td style="text-align: center; width: 8%;">${row.sNo}</td>
              <td style="text-align: left; width: 52%;">${row.description}</td>
              <td style="text-align: center; width: 10%;">${row.quantity}</td>
              <td style="text-align: right; width: 14%;">${formatCurrency(row.rate)}</td>
              <td style="text-align: right; width: 16%;">${formatCurrency(row.amount)}</td>
            </tr>
          `;
        } else {
          return `
            <tr>
              <td style="text-align: center; width: 5%;">${row.sNo}</td>
              <td style="text-align: left; width: 35%;">${row.description}</td>
              <td style="text-align: center; width: 9%;">${row.boardThickness || "-"}</td>
              <td style="text-align: center; width: 8%;">${row.size || "-"}</td>
              <td style="text-align: center; width: 8%;">${row.unit}</td>
              <td style="text-align: center; width: 8%;">${row.area || 0}</td>
              <td style="text-align: center; width: 8%;">${row.type || "Standard"}</td>
              <td style="text-align: center; width: 6%;">${row.quantity || 0}</td>
              <td style="text-align: right; width: 10%;">${formatCurrency(row.rate)}</td>
              <td style="text-align: right; width: 13%;">${formatCurrency(row.amount)}</td>
            </tr>
          `;
        }
      })
      .join("");

    const subtotal = invoice.rows.reduce((sum, r) => sum + r.amount, 0);
    const discount = invoice.discount || 0;
    const totalAmount = Math.max(0, subtotal - discount);
    const paidAmount = invoice.paidAmount || 0;
    const balanceDue = Math.max(0, totalAmount - paidAmount);

    const docTitle = invoice.format === "QUOTATION" ? "QUOTATION" : "TAX INVOICE";

    // Resolve template image
    const templateImg =
      invoice.format === "QUOTATION"
        ? invoice.shop === "SZ SIGNAGE"
          ? szImageQuotation
          : stickerZoneImageQuotation
        : invoice.shop === "SZ SIGNAGE"
        ? szImage
        : stickerZoneImage;

    const htmlString = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${docTitle}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            background-image: url("${templateImg}");
            background-size: 210mm 297mm;
            background-repeat: no-repeat;
            background-position: center top;
            -webkit-print-color-adjust: exact;
            position: relative;
          }
          
          /* Company Header Overlay */
          .company-header-block {
            position: absolute;
            top: 15mm;
            color: #ffffff;
            line-height: 1.25;
          }
          .company-name {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .company-tagline {
            font-size: 9px;
            margin-top: 1px;
            font-weight: 500;
            color: #dcdce6;
          }
          .company-address {
            font-size: 7.5px;
            margin-top: 2px;
            color: #b3b3cc;
          }
          .company-phone {
            font-size: 7.5px;
            margin-top: 1px;
            color: #b3b3cc;
          }

          /* Document Title Overlay */
          .document-title {
            position: absolute;
            top: 60mm;
            left: 14mm;
            font-size: 24px;
            font-weight: bold;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          /* Metadata Section Overlay */
          .meta-section {
            position: absolute;
            top: 72mm;
            left: 14mm;
            width: 182mm;
            font-size: 8.5px;
            display: flex;
            justify-content: space-between;
          }
          .meta-left {
            width: 60%;
          }
          .meta-right {
            width: 35%;
            text-align: right;
          }
          .meta-row {
            margin-bottom: 5px;
            height: 12px;
          }
          .meta-label {
            font-weight: bold;
            color: #323232;
            display: inline-block;
            width: 90px;
          }
          .meta-right .meta-label {
            width: auto;
            margin-right: 8px;
          }
          .meta-value {
            color: #646464;
          }

          /* Relative Table Container pushed down */
          .table-container {
            margin-top: 105mm;
            padding-left: 14mm;
            padding-right: 14mm;
            width: 182mm;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background-color: #1e1e2d;
            color: #ffffff;
            font-size: 7px;
            font-weight: bold;
            text-align: center;
            padding: 5px;
            border: 1px solid #3a3a4d;
            text-transform: uppercase;
          }
          td {
            font-size: 7px;
            color: #333333;
            padding: 5px;
            border: 1px solid #e0e0e0;
            background-color: #ffffff;
          }

          /* Summary Calculations */
          .summary-box {
            margin-top: 8px;
            display: flex;
            justify-content: flex-end;
          }
          .summary-table {
            width: 180px;
          }
          .summary-table td {
            border: none;
            font-size: 7.5px;
            padding: 2px 4px;
            background-color: transparent;
          }
          .summary-table tr.total-row td {
            border-top: 1px solid #cccccc;
            border-bottom: 2px double #1e1e2d;
            font-size: 8px;
            font-weight: bold;
          }

          /* Bottom Footer Section Overlay */
          .footer-area {
            position: absolute;
            bottom: 12mm;
            left: 14mm;
            width: 182mm;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .bank-details-box {
            font-size: 7.5px;
            color: #000000;
            line-height: 1.35;
          }
          .quotation-disclaimer {
            text-align: left;
            width: 65%;
          }
          .disclaimer-title {
            color: #ff0000;
            font-size: 10px;
            font-weight: bold;
          }
          .disclaimer-subtitle {
            color: #000000;
            font-size: 8.5px;
            font-weight: bold;
            margin-top: 4px;
          }
          .signature-block {
            text-align: right;
            width: 30%;
          }
          .sig-title {
            font-size: 8.5px;
            font-weight: bold;
            color: #000000;
            margin-bottom: 24px;
          }
          .sig-line {
            border-top: 1px solid #cccccc;
            width: 110px;
            display: inline-block;
          }
          .sig-label {
            font-size: 7.5px;
            color: #646464;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>

        <!-- Company Header Block Overlay -->
        <div class="company-header-block" style="left: ${invoice.shop === 'SZ SIGNAGE' ? '28mm' : '37mm'};">
          <div class="company-name">${invoice.shop}</div>
          <div class="company-tagline">THE COMPLETE SOLUTION</div>
          <div class="company-address">AYYAMPET,THANJAVUR - 614201</div>
          <div class="company-phone">Tel: +91 9790343367</div>
        </div>

        <!-- Document Title Overlay -->
        <div class="document-title">${invoice.format}</div>

        <!-- Metadata Section Overlay -->
        <div class="meta-section">
          <div class="meta-left">
            <div class="meta-row">
              <span class="meta-label">${invoice.format === "INVOICE" ? "Invoice No:" : "Quotation No:"}</span>
              <span class="meta-value">${invoice.invoiceNumber}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Customer:</span>
              <span class="meta-value">${invoice.customerName.toUpperCase()}</span>
            </div>
            ${
              invoice.projectName
                ? `
            <div class="meta-row">
              <span class="meta-label">Project Name:</span>
              <span class="meta-value">${invoice.projectName}</span>
            </div>
            `
                : ""
            }
            ${
              invoice.invoiceType
                ? `
            <div class="meta-row">
              <span class="meta-label">Invoice Type:</span>
              <span class="meta-value">${invoice.invoiceType}</span>
            </div>
            `
                : ""
            }
          </div>

          <div class="meta-right">
            <div class="meta-row">
              <span class="meta-label">Date:</span>
              <span class="meta-value">${dayjs(invoice.date).format("DD MMMM, YYYY")}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Shop:</span>
              <span class="meta-value">${invoice.shop}</span>
            </div>
          </div>
        </div>

        <!-- Flow Table Container -->
        <div class="table-container">
          <table>
            <thead>
              <tr>
                ${
                  isOldLayout
                    ? `
                  <th style="width: 8%;">S.NO</th>
                  <th style="width: 52%; text-align: left;">DESCRIPTION</th>
                  <th style="width: 10%;">QTY</th>
                  <th style="width: 14%; text-align: right;">RATE</th>
                  <th style="width: 16%; text-align: right;">AMOUNT</th>
                `
                    : `
                  <th style="width: 5%;">S.NO</th>
                  <th style="width: 35%; text-align: left;">DESCRIPTION</th>
                  <th style="width: 9%;">THICKNESS</th>
                  <th style="width: 8%;">SIZE</th>
                  <th style="width: 8%;">UNIT</th>
                  <th style="width: 8%;">AREA</th>
                  <th style="width: 8%;">TYPE</th>
                  <th style="width: 6%;">QTY</th>
                  <th style="width: 10%; text-align: right;">RATE</th>
                  <th style="width: 13%; text-align: right;">AMOUNT</th>
                `
                }
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- Summary Block Flow -->
          <div class="summary-box">
            <table class="summary-table">
              ${
                discount > 0
                  ? `
                <tr>
                  <td style="color: #646464;">Subtotal</td>
                  <td style="text-align: right; font-weight: bold;">${formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td style="color: #646464;">Discount</td>
                  <td style="text-align: right; font-weight: bold;">-${formatCurrency(discount)}</td>
                </tr>
              `
                  : ""
              }
              <tr class="total-row">
                <td>Total</td>
                <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
              </tr>
              ${
                paidAmount > 0
                  ? `
                <tr>
                  <td style="color: #646464;">Paid</td>
                  <td style="text-align: right; font-weight: bold;">${formatCurrency(paidAmount)}</td>
                </tr>
                <tr class="total-row" style="color: #C62828;">
                  <td>Balance Due</td>
                  <td style="text-align: right;">${formatCurrency(balanceDue)}</td>
                </tr>
              `
                  : ""
              }
            </table>
          </div>
        </div>

        <!-- Footer Area Overlay -->
        <div class="footer-area">
          ${
            invoice.format !== "INVOICE"
              ? `
            <div class="quotation-disclaimer">
              <div class="disclaimer-title">INSTALLATION AND TRANSPORT CHARGES ARE EXTRA</div>
              <div class="disclaimer-subtitle">THANK YOU FOR YOUR BUSINESS!</div>
            </div>
          `
              : `
            <div class="bank-details-box">
              <div>A/C NAME &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;UBAIYATHUL JIBRI</div>
              <div style="margin-top: 3px;">BANK NAME &nbsp;: &nbsp;ICICI BANK</div>
              <div style="margin-top: 3px;">A/C NO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;000101628687</div>
              <div style="margin-top: 3px;">IFSC NO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;ICIC0000001</div>
            </div>
          `
          }

          <div class="signature-block">
            <div class="sig-title">For ${invoice.shop}</div>
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>

      </body>
      </html>
    `;

    // Compile print PDF and share
    const { uri } = await Print.printToFileAsync({ html: htmlString });
    const safeShop = invoice.shop.replace(/\s+/g, "_");
    const safeInvNum = invoice.invoiceNumber || "DRAFT";
    const filename = `${safeShop}_${safeInvNum}.pdf`;
    const targetUri = `${documentDirectory}${filename}`;

    // Move to readable filename
    await moveAsync({
      from: uri,
      to: targetUri,
    });

    // Share PDF
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/pdf",
      dialogTitle: "Download PDF",
      UTI: "com.adobe.pdf",
    });
  } catch (error) {
    console.error("Failed to export PDF:", error);
    throw error;
  }
};

export const exportInvoiceExcel = async (invoice: StoredInvoice) => {
  try {
    const url = `${API_URL}/api/invoices/${invoice._id}/excel`;
    const safeShop = invoice.shop.replace(/\s+/g, "_");
    const safeInvNum = invoice.invoiceNumber || "DRAFT";
    const filename = `${safeShop}_${safeInvNum}.xlsx`;
    const targetUri = `${documentDirectory}${filename}`;

    const downloadRes = await downloadAsync(url, targetUri);
    if (downloadRes.status !== 200) {
      Alert.alert("Error", "Failed to generate Excel file on server.");
      return;
    }

    // Trigger Native Share Dialog
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Download Excel Invoice",
      UTI: "com.microsoft.excel.xlsx",
    });
  } catch (error) {
    console.error("Failed to export Excel:", error);
    Alert.alert("Error", "Failed to download Excel file from server.");
  }
};
