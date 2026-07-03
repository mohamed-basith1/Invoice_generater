import {
  Box,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Menu,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PaymentsIcon from "@mui/icons-material/Payments";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useEffect, useState, useMemo } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { generateInvoicePDF } from "../utils/printer";

interface StoredInvoice {
  _id: string;
  customerName: string;
  invoiceNumber: string;
  date: string;
  projectName: string;
  shop: string;
  invoiceType: string;
  format: string; // "INVOICE" or "QUOTATION"
  rows: any[];
  totalAmount: number;
  paidAmount?: number;
  paymentStatus?: string;
  discount?: number;
  layoutMode?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const HistoryPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Dayjs | null>(dayjs());
  const [endDate, setEndDate] = useState<Dayjs | null>(dayjs());
  const [documentType, setDocumentType] = useState<"ALL" | "INVOICE" | "QUOTATION">("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"ALL" | "UNPAID" | "PARTIALLY PAID" | "FULLY PAID">("ALL");
  const [loading, setLoading] = useState(false);

  // Pagination & Server-side filtering states
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [rowCount, setRowCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Quick Pay Modal State
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<StoredInvoice | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState<number | "">("");

  // Download Menu States
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeInvoiceForDownload, setActiveInvoiceForDownload] = useState<StoredInvoice | null>(null);

  const handleDownloadClick = (event: React.MouseEvent<HTMLElement>, invoice: StoredInvoice) => {
    setDownloadMenuAnchor(event.currentTarget);
    setActiveInvoiceForDownload(invoice);
  };

  const handleDownloadClose = () => {
    setDownloadMenuAnchor(null);
    setActiveInvoiceForDownload(null);
  };

  const handleDownloadPDF = () => {
    if (activeInvoiceForDownload) {
      generateInvoicePDF(
        activeInvoiceForDownload.rows,
        activeInvoiceForDownload.totalAmount,
        activeInvoiceForDownload,
        activeInvoiceForDownload.layoutMode || "new"
      );
    }
    handleDownloadClose();
  };

  const handleDownloadExcelSingle = async () => {
    if (!activeInvoiceForDownload) return;
    try {
      const invoice = activeInvoiceForDownload;
      const isOldLayout = invoice.layoutMode === "old";
      const currentInvoiceNumber = invoice.invoiceNumber;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Invoice");

      // Define grid columns
      if (isOldLayout) {
        worksheet.columns = [
          { key: "sNo", width: 8 },
          { key: "description", width: 50 },
          { key: "quantity", width: 12 },
          { key: "rate", width: 15 },
          { key: "amount", width: 18 }
        ];
      } else {
        worksheet.columns = [
          { key: "sNo", width: 8 },
          { key: "description", width: 35 },
          { key: "thickness", width: 14 },
          { key: "size", width: 12 },
          { key: "unit", width: 10 },
          { key: "area", width: 10 },
          { key: "type", width: 12 },
          { key: "quantity", width: 10 },
          { key: "rate", width: 14 },
          { key: "amount", width: 18 }
        ];
      }

      const totalCols = isOldLayout ? 5 : 10;
      const amountColLetter = isOldLayout ? "E" : "J";

      // Row 1: Spacing
      worksheet.addRow([]);
      worksheet.getRow(1).height = 10;

      // Helper function to fill a range of cells with a solid background color
      const fillRangeBackground = (startRow: number, startCol: number, endRow: number, endCol: number, colorArgb: string) => {
        for (let r = startRow; r <= endRow; r++) {
          const rowObj = worksheet.getRow(r);
          for (let c = startCol; c <= endCol; c++) {
            const cell = rowObj.getCell(c);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: colorArgb }
            };
          }
        }
      };

      // Fill rows 2 to 7, columns 1 to totalCols, with the solid brand background color
      const headerColor = "FF1E1E2D";
      fillRangeBackground(2, 1, 7, totalCols, headerColor);

      // Left Side Title: "INVOICE" or "QUOTATION" (Merged from row 3 to 6 inside rows 2 to 7 banner)
      const leftMergeEndCol = isOldLayout ? 3 : 6;
      worksheet.mergeCells(3, 1, 6, leftMergeEndCol);
      const titleCell = worksheet.getCell("A3");
      titleCell.value = invoice.format;
      titleCell.font = {
        name: "Segoe UI",
        size: 32,
        bold: true,
        color: { argb: "FFFFFFFF" }
      };
      titleCell.alignment = {
        vertical: "middle",
        horizontal: "left",
        indent: 3 // More left padding
      };

      // Right Side Company Info: (Rows 3 to 6, right aligned with spaces for padding)
      const rightMergeStartCol = isOldLayout ? 4 : 8;
      
      const setRightHeaderCell = (rowNum: number, text: string, isBold: boolean = false, size: number = 9.5) => {
        worksheet.mergeCells(rowNum, rightMergeStartCol, rowNum, totalCols);
        const cell = worksheet.getRow(rowNum).getCell(rightMergeStartCol);
        cell.value = text + "     "; // More right padding (5 spaces)
        cell.font = {
          name: "Segoe UI",
          size: size,
          bold: isBold,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "right"
        };
      };

      setRightHeaderCell(3, invoice.shop, true, 11);
      setRightHeaderCell(4, "No 12, Main Street Road", false, 9.5);
      setRightHeaderCell(5, "Ayyampet, Thanjavur - 614201", false, 9.5);
      setRightHeaderCell(6, "Phone: +91 9790343367", false, 9.5);

      // Set heights for the header rows (row 2 and 7 are empty spacers for symmetric vertical padding)
      worksheet.getRow(2).height = 20; // Top padding
      worksheet.getRow(3).height = 18;
      worksheet.getRow(4).height = 18;
      worksheet.getRow(5).height = 18;
      worksheet.getRow(6).height = 18;
      worksheet.getRow(7).height = 20; // Bottom padding

      // Row 8: Blank Spacer (row 7 is now part of the banner block)
      worksheet.addRow([]);
      worksheet.getRow(8).height = 15;

      // Fill the entire metadata block (rows 8 to 15) with solid white background to hide gridlines
      fillRangeBackground(8, 1, 15, totalCols, "FFFFFFFF");

      // Left-side metadata label helper (Writing to Column A as rich text, spilling into B)
      const setLeftMeta = (rowNum: number, label: string, val: string) => {
        const rowObj = worksheet.getRow(rowNum);
        const cell = rowObj.getCell(1); // Column A
        cell.value = {
          richText: [
            { text: label.padEnd(24, " "), font: { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF000000" } } },
            { text: val, font: { name: "Segoe UI", size: 9.5, color: { argb: "FF333333" } } }
          ]
        };
        cell.alignment = { vertical: "middle", horizontal: "left" };
      };

      // Right-side metadata (Bill To details)
      const rightCol = totalCols;

      const setRightMeta = (rowNum: number, text: string, isBold: boolean = false, textColor: string = "FF000000") => {
        const rowObj = worksheet.getRow(rowNum);
        const cell = rowObj.getCell(rightCol);
        cell.value = text + "   "; // Append spaces for clean right margin/padding
        cell.font = { name: "Segoe UI", size: 9.5, bold: isBold, color: { argb: textColor } };
        cell.alignment = { vertical: "middle", horizontal: "right" };
      };

      // Set metadata values (aligned in same-row pairs)
      setLeftMeta(10, invoice.format === "INVOICE" ? "Invoice No." : "Quotation No.", invoice.invoiceNumber);
      setRightMeta(10, "Bill To", true, "FF000000");

      setLeftMeta(11, "Date of Issue", dayjs(invoice.date).format("DD MMM YYYY"));
      setRightMeta(11, invoice.customerName.toUpperCase(), true, "FF000000");

      if (invoice.projectName) {
        setLeftMeta(12, "Project Name", invoice.projectName);
      }
      
      let infoText = "";
      if (invoice.projectName) {
        infoText = `Project: ${invoice.projectName}`;
      } else {
        infoText = invoice.invoiceType || "";
      }
      if (infoText) {
        setRightMeta(12, infoText, false, "FF555555");
      }

      if (invoice.invoiceType) {
        setLeftMeta(13, "Invoice Type", invoice.invoiceType);
      }

      // Format metadata rows heights
      for (let r = 9; r <= 15; r++) {
        worksheet.getRow(r).height = 18;
      }

      // Row 15: Blank Spacer
      worksheet.addRow([]);
      worksheet.getRow(15).height = 15;

      // Row 16: Table Headers
      const headerRowObj = worksheet.getRow(16);
      headerRowObj.height = 26;

      let headers: string[];
      if (isOldLayout) {
        headers = ["S.NO", "DESCRIPTION", "QTY", "RATE", "AMOUNT"];
      } else {
        headers = [
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
        ];
      }

      headers.forEach((h, index) => {
        const cell = headerRowObj.getCell(index + 1);
        cell.value = h;
        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E1E2D" }
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF1E1E2D" } },
          bottom: { style: "medium", color: { argb: "FF1E1E2D" } },
          left: { style: "thin", color: { argb: "FF3A3A4D" } },
          right: { style: "thin", color: { argb: "FF3A3A4D" } }
        };
      });

      // Item Rows
      let currentRowIndex = 17;
      invoice.rows.forEach((item, index) => {
        const itemRowObj = worksheet.getRow(currentRowIndex);
        itemRowObj.height = 22;

        let rowValues: any[];
        if (isOldLayout) {
          rowValues = [
            index + 1,
            item.description,
            item.quantity,
            item.rate,
            `=C${currentRowIndex}*D${currentRowIndex}`
          ];
        } else {
          rowValues = [
            index + 1,
            item.description,
            item.boardThickness || "-",
            item.size || "-",
            item.unit || "-",
            item.area || 0,
            item.type || "-",
            item.quantity,
            item.rate,
            item.type === "Other"
              ? item.amount
              : `=IF(G${currentRowIndex}="Other", ${item.amount}, IF(E${currentRowIndex}="Sq.ft", IF(H${currentRowIndex}=0, 1, H${currentRowIndex})*F${currentRowIndex}*I${currentRowIndex}, H${currentRowIndex}*I${currentRowIndex}))`
          ];
        }

        rowValues.forEach((val, colIdx) => {
          const cell = itemRowObj.getCell(colIdx + 1);
          if (typeof val === "string" && val.startsWith("=")) {
            cell.value = { formula: val.substring(1) };
          } else {
            cell.value = val;
          }
          cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF333333" } };

          if (colIdx === 0) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (colIdx === 1) {
            cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
          } else if (isOldLayout) {
            if (colIdx === 2) {
              cell.alignment = { vertical: "middle", horizontal: "center" };
            } else {
              cell.alignment = { vertical: "middle", horizontal: "right" };
              cell.numFormat = '"₹"#,##0.00';
            }
          } else {
            if (colIdx >= 2 && colIdx <= 6) {
              cell.alignment = { vertical: "middle", horizontal: "center" };
              if (colIdx === 5) {
                cell.numFormat = "#,##0.00";
              }
            } else if (colIdx === 7) {
              cell.alignment = { vertical: "middle", horizontal: "center" };
            } else {
              cell.alignment = { vertical: "middle", horizontal: "right" };
              cell.numFormat = '"₹"#,##0.00';
            }
          }

          cell.border = {
            top: { style: "thin", color: { argb: "FFE0E0E0" } },
            bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
            left: { style: "thin", color: { argb: "FFE0E0E0" } },
            right: { style: "thin", color: { argb: "FFE0E0E0" } }
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFFFF" }
          };
        });

        currentRowIndex++;
      });

      // Spacer row with white background
      const spacerRowObj = worksheet.getRow(currentRowIndex);
      spacerRowObj.height = 10;
      for (let c = 1; c <= totalCols; c++) {
        spacerRowObj.getCell(c).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" }
        };
      }
      currentRowIndex++;

      // Summary Calculations
      const discountVal = invoice.discount || 0;
      const paidVal = invoice.paidAmount || 0;
      const totalAmountVal = invoice.totalAmount || 0;
      const balanceVal = Math.max(0, totalAmountVal - paidVal);

      // Track row coordinates for formulas
      const endItemRow = currentRowIndex - 2;
      const subtotalRow = currentRowIndex;
      let discountRow = -1;
      let totalRow = -1;
      let paidRow = -1;

      const addSummaryRow = (label: string, value: any, isBold: boolean, textColorArgb?: string) => {
        const sumRow = worksheet.getRow(currentRowIndex);
        sumRow.height = 20;

        // Fill entire row with white background to hide default gridlines
        for (let c = 1; c <= totalCols; c++) {
          sumRow.getCell(c).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFFFF" }
          };
        }

        const labelCell = sumRow.getCell(totalCols - 1);
        labelCell.value = label;
        labelCell.font = {
          name: "Segoe UI",
          size: 10,
          bold: isBold,
          color: textColorArgb ? { argb: textColorArgb } : undefined
        };
        labelCell.alignment = { vertical: "middle", horizontal: "right" };

        const valCell = sumRow.getCell(totalCols);
        if (typeof value === "string" && value.startsWith("=")) {
          valCell.value = { formula: value.substring(1) };
        } else {
          valCell.value = value;
        }
        valCell.font = {
          name: "Segoe UI",
          size: 10,
          bold: isBold,
          color: textColorArgb ? { argb: textColorArgb } : undefined
        };
        valCell.alignment = { vertical: "middle", horizontal: "right" };
        valCell.numFormat = '"₹"#,##0.00';

        if (label === "Total" || label === "Balance Due") {
          labelCell.border = {
            top: { style: "thin", color: { argb: "FFCCCCCC" } },
            bottom: { style: "double", color: { argb: "FF1E1E2D" } }
          };
          valCell.border = {
            top: { style: "thin", color: { argb: "FFCCCCCC" } },
            bottom: { style: "double", color: { argb: "FF1E1E2D" } }
          };
        }

        currentRowIndex++;
      };

      addSummaryRow("Subtotal", `=SUM(${amountColLetter}17:${amountColLetter}${endItemRow})`, false);
      if (discountVal > 0) {
        discountRow = currentRowIndex;
        addSummaryRow("Discount", discountVal, false);
      }
      
      totalRow = currentRowIndex;
      if (discountRow !== -1) {
        addSummaryRow("Total", `=${amountColLetter}${subtotalRow}-${amountColLetter}${discountRow}`, true, "FF1E1E2D");
      } else {
        addSummaryRow("Total", `=${amountColLetter}${subtotalRow}`, true, "FF1E1E2D");
      }
      
      if (paidVal > 0) {
        paidRow = currentRowIndex;
        addSummaryRow("Paid", paidVal, false);
        addSummaryRow("Balance Due", `=MAX(0,${amountColLetter}${totalRow}-${amountColLetter}${paidRow})`, true, balanceVal > 0 ? "FFD32F2F" : "FF2E7D32");
      }

      const startFooterRow = currentRowIndex;

      // Bank Details or Installation Disclaimer
      if (invoice.format === "INVOICE") {
        const titleRow = worksheet.getRow(currentRowIndex);
        titleRow.getCell(2).value = "BANK DETAILS:";
        titleRow.getCell(2).font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF555555" } };

        const setBankRow = (label: string, val: string) => {
          currentRowIndex++;
          const rowObj = worksheet.getRow(currentRowIndex);
          rowObj.getCell(2).value = `${label}  ${val}`;
          rowObj.getCell(2).font = { name: "Segoe UI", size: 9.5, color: { argb: "FF444444" } };
        };

        setBankRow("A/C NAME:", "UBAIYATHUL JIBRI");
        setBankRow("BANK NAME:", "ICICI BANK");
        setBankRow("A/C NO:", "000101628687");
        setBankRow("IFSC NO:", "ICIC0000001");
      } else {
        const disclaimerRow = worksheet.getRow(currentRowIndex);
        disclaimerRow.getCell(2).value = "INSTALLATION AND TRANSPORT CHARGES ARE EXTRA";
        disclaimerRow.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFD32F2F" } };
      }

      currentRowIndex += 2;
      const thankYouRow = worksheet.getRow(currentRowIndex);
      thankYouRow.getCell(2).value = "Thank you for your business!";
      thankYouRow.getCell(2).font = { name: "Segoe UI", size: 11, italic: true, color: { argb: "FF777777" } };

      // Fill footer / disclaimer / bank details and bottom spacers with solid white background to hide gridlines
      fillRangeBackground(startFooterRow, 1, currentRowIndex + 2, totalCols, "FFFFFFFF");

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const filename = `${invoice.shop.replace(/\s+/g, "_")}_${invoice.invoiceNumber || "DRAFT"}.xlsx`;
      saveAs(blob, filename);

    } catch (err) {
      console.error("Failed to generate ExcelJS invoice:", err);
      alert("Failed to export invoice to Excel.");
    }
    handleDownloadClose();
  };

  // Debounce search input to avoid hitting backend on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to first page when query filters change
  useEffect(() => {
    setPage(0);
  }, [activeTab, documentType, paymentStatusFilter, debouncedSearch, startDate, endDate]);

  // Fetch paginated invoices from backend
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {
        shop: activeTab === 0 ? "SZ SIGNAGE" : "STICKER ZONE",
        page: page + 1, // backend page index starts at 1
        limit: pageSize,
      };

      if (documentType !== "ALL") {
        params.format = documentType;
      }

      if (paymentStatusFilter !== "ALL") {
        params.paymentStatus = paymentStatusFilter;
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }

      if (startDate) {
        params.startDate = startDate.startOf("day").toISOString();
      }

      if (endDate) {
        params.endDate = endDate.endOf("day").toISOString();
      }

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";
      const response = await axios.get(`${apiUrl}/api/invoices`, { params });
      setInvoices(response.data.invoices);
      setRowCount(response.data.totalCount);
      setTotalRevenue(response.data.totalRevenue);
      setTotalPaid(response.data.totalPaid || 0);
      setTotalBalance(response.data.totalBalance || 0);
    } catch (err) {
      console.error("Error fetching invoice history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, activeTab, documentType, paymentStatusFilter, debouncedSearch, startDate, endDate]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this record from history?")) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";
        await axios.delete(`${apiUrl}/api/invoices/${id}`);
        fetchInvoices(); // Refresh the list from the database
      } catch (err) {
        console.error("Failed to delete record:", err);
        alert("Failed to delete the record from database.");
      }
    }
  };

  const handleQuickPaySave = async () => {
    if (!selectedInvoice) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";
      await axios.put(`${apiUrl}/api/invoices/${selectedInvoice._id}`, {
        ...selectedInvoice,
        paidAmount: Number(quickPayAmount || 0)
      });
      setQuickPayOpen(false);
      setSelectedInvoice(null);
      fetchInvoices(); // Refresh the list
    } catch (err) {
      console.error("Failed to update payment amount:", err);
      alert("Failed to update the payment amount.");
    }
  };

  const handleExportExcel = async () => {
    try {
      const params: any = {
        shop: activeTab === 0 ? "SZ SIGNAGE" : "STICKER ZONE",
        page: 1,
        limit: 100000, // retrieve all matching records
      };

      if (documentType !== "ALL") {
        params.format = documentType;
      }

      if (paymentStatusFilter !== "ALL") {
        params.paymentStatus = paymentStatusFilter;
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }

      if (startDate) {
        params.startDate = startDate.startOf("day").toISOString();
      }

      if (endDate) {
        params.endDate = endDate.endOf("day").toISOString();
      }

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";
      const response = await axios.get(`${apiUrl}/api/invoices`, { params });
      const exportInvoices: StoredInvoice[] = response.data.invoices || [];

      if (exportInvoices.length === 0) {
        alert("No records found to export.");
        return;
      }

      // Prepare headers
      const headers = [
        "Document No",
        "Date",
        "Customer Name",
        "Project Name",
        "Shop Office",
        "Document Type",
        "Total Amount (INR)",
        "Paid Amount (INR)",
        "Balance Outstanding (INR)",
        "Payment Status"
      ];

      // Prepare data rows
      const dataRows = exportInvoices.map((inv) => {
        const total = inv.totalAmount || 0;
        const paid = inv.paidAmount || 0;
        const balance = total - paid;
        const status = inv.paymentStatus || "UNPAID";

        return [
          inv.invoiceNumber,
          dayjs(inv.date).format("YYYY-MM-DD"),
          inv.customerName,
          inv.projectName || "",
          inv.shop,
          inv.format,
          total,
          paid,
          balance,
          status
        ];
      });

      // Combine headers and rows
      const sheetData = [headers, ...dataRows];

      // Create Worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

      // Set column widths to look polished
      const colWidths = [
        { wch: 18 }, // Document No
        { wch: 12 }, // Date
        { wch: 25 }, // Customer Name
        { wch: 20 }, // Project Name
        { wch: 18 }, // Shop Office
        { wch: 15 }, // Document Type
        { wch: 18 }, // Total Amount
        { wch: 12 }, // Paid Amount
        { wch: 25 }, // Balance Outstanding
        { wch: 15 }  // Payment Status
      ];
      worksheet["!cols"] = colWidths;

      // Create Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Billing Records");

      // Generate file and trigger download
      const filename = `${params.shop.replace(/\s+/g, "_")}_Export_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error("Failed to export invoices to Excel:", err);
      alert("Failed to export data to Excel.");
    }
  };

  const columns: GridColDef[] = useMemo(() => [
    {
      field: "sNo",
      headerName: "S. No",
      width: 70,
      renderCell: (params) => {
        const index = params.api.getRowIndexRelativeToVisibleRows(params.id);
        return <span>{page * pageSize + index + 1}</span>;
      }
    },
    {
      field: "date",
      headerName: "Date",
      width: 130,
      valueFormatter: (value: any) => dayjs(value).format("DD MMM YYYY"),
    },
    { field: "invoiceNumber", headerName: "Document No", width: 140 },
    { field: "customerName", headerName: "Customer Name", flex: 1 },
    { field: "projectName", headerName: "Project Name", width: 150 },
    {
      field: "format",
      headerName: "Type",
      width: 110,
      renderCell: (params) => (
        <span
          style={{
            color: params.value === "INVOICE" ? "#22b378" : "#ff9800",
            fontWeight: "bold",
          }}
        >
          {params.value}
        </span>
      ),
    },
    {
      field: "totalAmount",
      headerName: "Total Amount",
      width: 120,
      align: "right",
      headerAlign: "right",
      valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
    },
    {
      field: "paidAmount",
      headerName: "Paid",
      width: 120,
      align: "right",
      headerAlign: "right",
      valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
    },
    {
      field: "balance",
      headerName: "Balance",
      width: 120,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => {
        const row = params.row as StoredInvoice;
        const balance = row.totalAmount - (row.paidAmount || 0);
        return (
          <span style={{ color: balance > 0 ? "#d32f2f" : "#2e7d32", fontWeight: "bold" }}>
            {formatCurrency(balance)}
          </span>
        );
      }
    },
    {
      field: "paymentStatus",
      headerName: "Status",
      width: 130,
      renderCell: (params) => {
        const value = params.value || "UNPAID";
        let color = "#d32f2f"; // red for UNPAID
        let bgColor = "#ffebee";
        if (value === "FULLY PAID") {
          color = "#2e7d32"; // green
          bgColor = "#e8f5e9";
        } else if (value === "PARTIALLY PAID") {
          color = "#ef6c00"; // orange
          bgColor = "#fff3e0";
        }
        return (
          <span
            style={{
              color,
             
              fontSize: "12px",
              fontWeight: "bold",
              textTransform: "uppercase",
              display: "inline-block",
            }}
          >
            {value}
          </span>
        );
      }
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 170,
      renderCell: (params) => {
        const row = params.row as StoredInvoice;
        return (
          <Box display="flex" gap={0.5}>
            <IconButton
              onClick={() => {
                setSelectedInvoice(row);
                setQuickPayAmount(row.paidAmount || 0);
                setQuickPayOpen(true);
              }}
              title="Update Payment"
            >
              <PaymentsIcon color="warning" fontSize="small" />
            </IconButton>
            <IconButton
              onClick={() => navigate(`/?edit=${row._id}`)}
              title="Edit Record"
            >
              <EditIcon color="primary" fontSize="small" />
            </IconButton>
            <IconButton
              onClick={(e) => handleDownloadClick(e, row)}
              title="Download Options"
            >
              <DownloadIcon color="success" fontSize="small" />
            </IconButton>
            <IconButton onClick={() => handleDelete(row._id)} title="Delete Record">
              <DeleteIcon color="error" fontSize="small" />
            </IconButton>
          </Box>
        );
      },
    },
  ], [invoices, page, pageSize]);

  return (
    <Box
      sx={{
        padding: 3,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 2.5,
        backgroundColor: "#fcfcfd",
        minHeight: "100vh",
      }}
    >
      {/* Top dashboard title */}
      <Box sx={{ borderBottom: "1px solid #eaeaea", pb: 2 }}>
        <Typography variant="h5" fontWeight="bold" color="text.primary">
          Invoicing & History Records
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track database history, filter transactions, and monitor shop revenue streams
        </Typography>
      </Box>

      {/* Top Shop selection Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(e, newVal) => setActiveTab(newVal)}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="SZ SIGNAGE" sx={{ fontWeight: "bold", fontSize: "14px" }} />
          <Tab label="STICKER ZONE" sx={{ fontWeight: "bold", fontSize: "14px" }} />
        </Tabs>
      </Box>

      {/* Revenue aggregated KPI display */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              border: "1px solid #e0e0e0",
              background: "linear-gradient(135deg, #1E1E2D 0%, #2b2b3d 100%)",
              color: "white",
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: "bold" }}>
                  TOTAL REVENUE
                </Typography>
                <TrendingUpIcon sx={{ color: "#22b378" }} />
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1.5, mb: 0.5 }}>
                {formatCurrency(totalRevenue)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Calculated dynamically for matching filtered items
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              border: "1px solid #e0e0e0",
              background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
              color: "white",
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: "bold" }}>
                  TOTAL COLLECTED
                </Typography>
                <TrendingUpIcon sx={{ color: "#a5d6a7" }} />
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1.5, mb: 0.5 }}>
                {formatCurrency(totalPaid)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Total amount received matching filters
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              border: "1px solid #e0e0e0",
              background: "linear-gradient(135deg, #c62828 0%, #b71c1c 100%)",
              color: "white",
            }}
          >
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: "bold" }}>
                  OUTSTANDING DUES
                </Typography>
                <TrendingUpIcon sx={{ color: "#ff8a80" }} />
              </Box>
              <Typography variant="h4" fontWeight="bold" sx={{ mt: 1.5, mb: 0.5 }}>
                {formatCurrency(totalBalance)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Total balance pending collection
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Dashboard Filters Toolbar */}
        <Grid item xs={12}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              border: "1px solid #e0e0e0",
              padding: 2,
              backgroundColor: "white",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" color="text.secondary" fontWeight="bold">
                SEARCH & DATE FILTERS
              </Typography>
              <Button
                variant="outlined"
                color="success"
                startIcon={<DownloadIcon />}
                onClick={handleExportExcel}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                Export Excel
              </Button>
            </Box>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Box flex={2} minWidth="200px">
                <TextField
                  label="Search"
                  placeholder="Customer, Doc Number, Project..."
                  fullWidth
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                  }}
                />
              </Box>

              <Box flex={1} minWidth="150px">
                <FormControl fullWidth>
                  <InputLabel id="history-type-label">Doc Type</InputLabel>
                  <Select
                    labelId="history-type-label"
                    label="Doc Type"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as any)}
                  >
                    <MenuItem value="ALL">All Documents</MenuItem>
                    <MenuItem value="INVOICE">Invoices</MenuItem>
                    <MenuItem value="QUOTATION">Quotations</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box flex={1} minWidth="160px">
                <FormControl fullWidth>
                  <InputLabel id="history-status-label">Payment Status</InputLabel>
                  <Select
                    labelId="history-status-label"
                    label="Payment Status"
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                  >
                    <MenuItem value="ALL">All Payments</MenuItem>
                    <MenuItem value="UNPAID">Unpaid</MenuItem>
                    <MenuItem value="PARTIALLY PAID">Partially Paid</MenuItem>
                    <MenuItem value="FULLY PAID">Fully Paid</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box display="flex" gap={1.5} flex={2} minWidth="280px">
                  <DatePicker
                    label="From Date"
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <DatePicker
                    label="To Date"
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Box>
              </LocalizationProvider>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Main History Table */}
      <Box
        sx={{
          height: "50vh",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: 3,
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        <DataGrid
          rows={invoices}
          columns={columns}
          getRowId={(row) => row._id}
          loading={loading}
          disableColumnMenu
          pagination
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page);
            setPageSize(model.pageSize);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#1E1E2D",
              color: "#ffffff",
            },
            "& .MuiDataGrid-columnHeader": {
              backgroundColor: "#1E1E2D",
              color: "#ffffff",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: "bold",
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid #f0f0f2",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "#f9f9fb",
            },
          }}
        />
      </Box>

      {/* Modal: Quick Pay / Update Payment */}
      <Dialog
        open={quickPayOpen}
        onClose={() => {
          setQuickPayOpen(false);
          setSelectedInvoice(null);
        }}
        PaperProps={{
          sx: {
            width: "450px",
            borderRadius: 3,
            padding: 1.5,
          },
        }}
      >
        <DialogTitle fontWeight="bold">Update Payment Details</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            paddingTop: 1.5,
          }}
        >
          {selectedInvoice && (
            <>
              <Typography variant="body2" color="text.secondary">
                Document Number: <strong>{selectedInvoice.invoiceNumber}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customer: <strong>{selectedInvoice.customerName}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Invoice Value: <strong>{formatCurrency(selectedInvoice.totalAmount)}</strong>
              </Typography>
              <TextField
                label="Paid Amount (INR)"
                type="number"
                fullWidth
                value={quickPayAmount}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setQuickPayAmount(val);
                }}
                helperText={`Outstanding Balance: ${formatCurrency(Math.max(0, selectedInvoice.totalAmount - Number(quickPayAmount || 0)))}`}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setQuickPayOpen(false);
              setSelectedInvoice(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleQuickPaySave}
            disabled={quickPayAmount === ""}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Download Options Menu */}
      <Menu
        anchorEl={downloadMenuAnchor}
        open={Boolean(downloadMenuAnchor)}
        onClose={handleDownloadClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: {
            boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)",
            borderRadius: 2,
            minWidth: 160,
          },
        }}
      >
        <MenuItem onClick={handleDownloadPDF}>
          <ListItemIcon>
            <PictureAsPdfIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Download PDF" />
        </MenuItem>
        <MenuItem onClick={handleDownloadExcelSingle}>
          <ListItemIcon>
            <TableChartIcon fontSize="small" color="success" />
          </ListItemIcon>
          <ListItemText primary="Download Excel" />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default HistoryPage;
