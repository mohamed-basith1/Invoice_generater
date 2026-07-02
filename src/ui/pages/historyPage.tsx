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
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { useEffect, useState, useMemo } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { Dayjs } from "dayjs";
import axios from "axios";
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
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const HistoryPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [documentType, setDocumentType] = useState<"ALL" | "INVOICE" | "QUOTATION">("ALL");
  const [loading, setLoading] = useState(false);

  // Pagination & Server-side filtering states
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [rowCount, setRowCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
  }, [activeTab, documentType, debouncedSearch, startDate, endDate]);

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

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch;
      }

      if (startDate) {
        params.startDate = startDate.startOf("day").toISOString();
      }

      if (endDate) {
        params.endDate = endDate.endOf("day").toISOString();
      }

      const response = await axios.get("http://localhost:5050/api/invoices", { params });
      setInvoices(response.data.invoices);
      setRowCount(response.data.totalCount);
      setTotalRevenue(response.data.totalRevenue);
    } catch (err) {
      console.error("Error fetching invoice history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, activeTab, documentType, debouncedSearch, startDate, endDate]);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this record from history?")) {
      try {
        await axios.delete(`http://localhost:5050/api/invoices/${id}`);
        fetchInvoices(); // Refresh the list from the database
      } catch (err) {
        console.error("Failed to delete record:", err);
        alert("Failed to delete the record from database.");
      }
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
      width: 140,
      align: "right",
      headerAlign: "right",
      valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 110,
      renderCell: (params) => {
        const row = params.row as StoredInvoice;
        return (
          <Box display="flex" gap={0.5}>
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

        {/* Dashboard Filters Toolbar */}
        <Grid item xs={12} md={8}>
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
            <Typography variant="subtitle2" color="text.secondary" fontWeight="bold">
              SEARCH & DATE FILTERS
            </Typography>
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
    </Box>
  );
};

export default HistoryPage;
