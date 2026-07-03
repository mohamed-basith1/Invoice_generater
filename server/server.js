const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Mongoose Schema Definitions
const ItemSchema = new mongoose.Schema({
  sNo: Number,
  description: String,
  boardThickness: String,
  size: String,
  unit: String,
  area: Number,
  type: String,
  quantity: Number,
  rate: Number,
  amount: Number
});

const CounterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 1000 }
});
const Counter = mongoose.model('Counter', CounterSchema);

const InvoiceSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  invoiceNumber: { type: String, required: true },
  date: { type: Date, required: true },
  projectName: String,
  shop: { type: String, required: true },
  invoiceType: String,
  format: { type: String, required: true },
  layoutMode: { type: String, default: "new" },
  paidAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["UNPAID", "PARTIALLY PAID", "FULLY PAID"], default: "UNPAID" },
  rows: [ItemSchema],
  totalAmount: { type: Number, required: true }
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', InvoiceSchema);

// API Endpoints

// 1. Create a new Invoice / Quotation
app.post('/api/invoices', async (req, res) => {
  try {
    const {
      customerName,
      invoiceNumber,
      date,
      projectName,
      shop,
      invoiceType,
      format,
      layoutMode,
      paidAmount,
      discount,
      rows,
      totalAmount
    } = req.body;

    console.log("POST /api/invoices - Received invoiceNumber:", invoiceNumber);
    let finalInvoiceNumber = invoiceNumber;
    if (!finalInvoiceNumber || (typeof finalInvoiceNumber === 'string' && finalInvoiceNumber.trim() === '')) {
      console.log("invoiceNumber is empty/blank, generating sequence...");
      const counterId = `${shop}_${format}`;
      const counter = await Counter.findOneAndUpdate(
        { id: counterId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      console.log("Generated counter document:", counter);
      const shopPrefix = shop === "SZ SIGNAGE" ? "SZ" : "SZS";
      const formatPrefix = format === "INVOICE" ? "INV" : "QT";
      finalInvoiceNumber = `${shopPrefix}-${formatPrefix}-${counter.seq}`;
      console.log("Assigned finalInvoiceNumber:", finalInvoiceNumber);
    }

    const finalPaidAmount = paidAmount === undefined ? 0 : Number(paidAmount);
    const finalDiscount = discount === undefined ? 0 : Number(discount);
    let finalPaymentStatus = "UNPAID";
    if (finalPaidAmount > 0) {
      if (finalPaidAmount >= totalAmount) {
        finalPaymentStatus = "FULLY PAID";
      } else {
        finalPaymentStatus = "PARTIALLY PAID";
      }
    }

    const newInvoice = new Invoice({
      customerName,
      invoiceNumber: finalInvoiceNumber,
      date: new Date(date),
      projectName,
      shop,
      invoiceType,
      format,
      layoutMode: layoutMode || "new",
      paidAmount: finalPaidAmount,
      discount: finalDiscount,
      paymentStatus: finalPaymentStatus,
      rows,
      totalAmount
    });

    const savedInvoice = await newInvoice.save();
    res.status(201).json(savedInvoice);
  } catch (error) {
    console.error('Error saving invoice:', error);
    res.status(500).json({ message: 'Failed to save invoice', error: error.message });
  }
});

// 2. Fetch all Invoices / Quotations with query filters & pagination
app.get('/api/invoices', async (req, res) => {
  try {
    const { shop, format, search, startDate, endDate, paymentStatus, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (shop) {
      filter.shop = shop;
    }

    if (format) {
      filter.format = format;
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      filter.paymentStatus = paymentStatus;
    }

    if (search) {
      // Search in customerName, invoiceNumber, or projectName
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const parsedEndDate = new Date(endDate);
        parsedEndDate.setHours(23, 59, 59, 999);
        filter.date.$lte = parsedEndDate;
      }
    }

    // A. Count total matching documents
    const totalCount = await Invoice.countDocuments(filter);

    // B. Calculate total revenue, paid, and balance matching the filters (using aggregation)
    const revenueResult = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
          totalPaid: { $sum: { $ifNull: ["$paidAmount", 0] } }
        }
      }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    const totalPaid = revenueResult.length > 0 ? revenueResult[0].totalPaid : 0;
    const totalBalance = totalRevenue - totalPaid;

    // C. Paginate invoices
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const invoices = await Invoice.find(filter)
      .sort({ date: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      invoices,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      totalRevenue,
      totalPaid,
      totalBalance
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Failed to retrieve invoices', error: error.message });
  }
});

// 3. Delete an invoice by ID
app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedInvoice = await Invoice.findByIdAndDelete(id);
    
    if (!deletedInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    res.json({ message: 'Invoice successfully deleted', id });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Failed to delete invoice', error: error.message });
  }
});

// 4. Update an invoice by ID
app.put('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      invoiceNumber,
      date,
      projectName,
      shop,
      invoiceType,
      format,
      layoutMode,
      paidAmount,
      discount,
      rows,
      totalAmount
    } = req.body;

    const finalPaidAmount = paidAmount === undefined ? 0 : Number(paidAmount);
    const finalDiscount = discount === undefined ? 0 : Number(discount);
    let finalPaymentStatus = "UNPAID";
    if (finalPaidAmount > 0) {
      if (finalPaidAmount >= totalAmount) {
        finalPaymentStatus = "FULLY PAID";
      } else {
        finalPaymentStatus = "PARTIALLY PAID";
      }
    }

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      id,
      {
        customerName,
        invoiceNumber,
        date: new Date(date),
        projectName,
        shop,
        invoiceType,
        format,
        layoutMode: layoutMode || "new",
        paidAmount: finalPaidAmount,
        discount: finalDiscount,
        paymentStatus: finalPaymentStatus,
        rows,
        totalAmount
      },
      { new: true }
    );

    if (!updatedInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Failed to update invoice', error: error.message });
  }
});

// 5. Get a single invoice by ID
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice by ID:', error);
    res.status(500).json({ message: 'Failed to fetch invoice', error: error.message });
  }
});

// 6. Generate and Download Excel Invoice / Quotation
app.get('/api/invoices/:id/excel', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const isOldLayout = invoice.layoutMode === "old";
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
    const fillRangeBackground = (startRow, startCol, endRow, endCol, colorArgb) => {
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

    // Left Side Title
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
      indent: 3
    };

    // Right Side Company Info
    const rightMergeStartCol = isOldLayout ? 4 : 8;
    const setRightHeaderCell = (rowNum, text, isBold = false, size = 9.5) => {
      worksheet.mergeCells(rowNum, rightMergeStartCol, rowNum, totalCols);
      const cell = worksheet.getRow(rowNum).getCell(rightMergeStartCol);
      cell.value = text + "     ";
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
    
    // Address / contact details based on shop selection
    const addressLine1 = invoice.shop === "SZ SIGNAGE" ? "No 16/17, Ground Floor, 1st Cross" : "No 45, Lalbagh Fort Road";
    const addressLine2 = invoice.shop === "SZ SIGNAGE" ? "J.C. Road, Bangalore - 560002" : "near Mavalli Circle, Bangalore - 560004";
    const phoneLine = invoice.shop === "SZ SIGNAGE" ? "Phone: +91 9900000000" : "Phone: +91 8800000000";

    setRightHeaderCell(4, addressLine1, false, 9.5);
    setRightHeaderCell(5, addressLine2, false, 9.5);
    setRightHeaderCell(6, phoneLine, false, 9.5);

    worksheet.getRow(2).height = 20;
    worksheet.getRow(3).height = 18;
    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 18;
    worksheet.getRow(6).height = 18;
    worksheet.getRow(7).height = 20;

    worksheet.addRow([]);
    worksheet.getRow(8).height = 15;

    fillRangeBackground(8, 1, 15, totalCols, "FFFFFFFF");

    // Left-side metadata
    const setLeftMeta = (rowNum, label, val) => {
      const rowObj = worksheet.getRow(rowNum);
      const cell = rowObj.getCell(1);
      cell.value = {
        richText: [
          { text: label.padEnd(24, " "), font: { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF000000" } } },
          { text: val, font: { name: "Segoe UI", size: 9.5, color: { argb: "FF333333" } } }
        ]
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    };

    const rightCol = totalCols;
    const setRightMeta = (rowNum, text, isBold = false, textColor = "FF000000") => {
      const rowObj = worksheet.getRow(rowNum);
      const cell = rowObj.getCell(rightCol);
      cell.value = text + "   ";
      cell.font = { name: "Segoe UI", size: 9.5, bold: isBold, color: { argb: textColor } };
      cell.alignment = { vertical: "middle", horizontal: "right" };
    };

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

    for (let r = 9; r <= 15; r++) {
      worksheet.getRow(r).height = 18;
    }

    worksheet.addRow([]);
    worksheet.getRow(15).height = 15;

    const headerRowObj = worksheet.getRow(16);
    headerRowObj.height = 26;

    let headers;
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

    let currentRowIndex = 17;
    invoice.rows.forEach((item, index) => {
      const itemRowObj = worksheet.getRow(currentRowIndex);
      itemRowObj.height = 22;

      let rowValues;
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
            cell.numFmt = '"₹"#,##0.00';
          }
        } else {
          if (colIdx >= 2 && colIdx <= 6) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            if (colIdx === 5) {
              cell.numFmt = "#,##0.00";
            }
          } else if (colIdx === 7) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = '"₹"#,##0.00';
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

    const discountVal = invoice.discount || 0;
    const paidVal = invoice.paidAmount || 0;
    const totalAmountVal = invoice.totalAmount || 0;
    const balanceVal = Math.max(0, totalAmountVal - paidVal);

    const endItemRow = currentRowIndex - 2;
    const subtotalRow = currentRowIndex;
    let discountRow = -1;
    let totalRow = -1;
    let paidRow = -1;

    const addSummaryRow = (label, value, isBold, textColorArgb) => {
      const sumRow = worksheet.getRow(currentRowIndex);
      sumRow.height = 20;

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
      valCell.numFmt = '"₹"#,##0.00';

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

    if (invoice.format === "INVOICE") {
      const titleRow = worksheet.getRow(currentRowIndex);
      titleRow.getCell(2).value = "BANK DETAILS:";
      titleRow.getCell(2).font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF555555" } };

      const setBankRow = (label, val) => {
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

    fillRangeBackground(startFooterRow, 1, currentRowIndex + 2, totalCols, "FFFFFFFF");

    const buffer = await workbook.xlsx.writeBuffer();
    const safeShop = invoice.shop.replace(/\s+/g, "_");
    const safeInvNum = invoice.invoiceNumber || "DRAFT";
    const filename = `${safeShop}_${safeInvNum}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ message: 'Failed to generate Excel', error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
