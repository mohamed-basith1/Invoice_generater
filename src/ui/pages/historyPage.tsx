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
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PaymentsIcon from "@mui/icons-material/Payments";
import { useEffect, useState, useMemo } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import { generateInvoicePDF } from "../utils/printer";

interface StoredInvoice {
  _id: string;
  customerName: string;
  invoiceNumber: string;
  date: string;
  projectName: string;
  referenceNumber: string;
  shop: string;
  invoiceType: string;
  format: string; // "INVOICE" or "QUOTATION"
  rows: any[];
  totalAmount: number;
  paidAmount?: number;
  paymentStatus?: string;
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
        "Reference No",
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
          inv.referenceNumber || "",
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
        { wch: 15 }, // Reference No
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
              backgroundColor: bgColor,
              padding: "4px 8px",
              borderRadius: "12px",
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
              onClick={() => generateInvoicePDF(row.rows, row.totalAmount, row, row.layoutMode || "new")}
              title="Download PDF"
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
    </Box>
  );
};

export default HistoryPage;
