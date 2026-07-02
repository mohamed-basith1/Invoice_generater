const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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
  referenceNumber: String,
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
      referenceNumber,
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
      referenceNumber,
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
      referenceNumber,
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
        referenceNumber,
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
