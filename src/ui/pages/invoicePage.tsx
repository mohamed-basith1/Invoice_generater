import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  Snackbar,
  Alert,
  Tab,
  Tabs,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LayersIcon from "@mui/icons-material/Layers";
import CloseIcon from "@mui/icons-material/Close";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import DynamicAutocomplete from "./AutosuggestionTextFields";
import { generateInvoicePDF } from "../utils/printer";

// Strong Interfaces
export interface InvoiceItem {
  id: number;
  sNo: number;
  description: string;
  boardThickness: string;
  size: string;
  unit: string;
  area: number;
  type: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceData {
  customerName: string;
  invoiceNumber: string;
  date: string;
  projectName: string;
  referenceNumber: string;
  shop: string;
  invoiceType: string;
  format: string; // "INVOICE" or "QUOTATION"
}

interface NewItemState {
  description: string;
  boardThickness: string;
  size: string;
  unit: string;
  area: number | "";
  type: string;
  quantity: number | "";
  rate: number | "";
  amount: number | "";
}

// Dropdown Options
const THICKNESS_OPTIONS = ["", "3 mm", "4 mm", "5 mm", "8 mm", "10 mm", "12 mm", "18 mm", "Other"];
const UNIT_OPTIONS = ["", "Nos", "Sq.ft", "Running Ft", "Set", "Piece"];
const TYPE_OPTIONS = [
  "",
  "ACP",
  "Acrylic",
  "Vinyl",
  "Sunboard",
  "MDF",
  "Foam Board",
  "LED",
  "Flex",
  "Glow Sign",
  "Sticker",
  "Other",
  "Custom",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const InvoicePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openInvoiceEditModal, setOpenInvoiceEditModal] = useState(false);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [showCustomType, setShowCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const [isOldLayout, setIsOldLayout] = useState(false);

  const [rows, setRows] = useState<InvoiceItem[]>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);

  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    customerName: "",
    invoiceNumber: "",
    date: "",
    projectName: "",
    referenceNumber: "",
    shop: "SZ SIGNAGE",
    invoiceType: "Signage Work",
    format: "INVOICE",
  });

  const [newItem, setNewItem] = useState<NewItemState>({
    description: "",
    boardThickness: "",
    size: "",
    unit: "",
    area: "",
    type: "",
    quantity: 1,
    rate: "",
    amount: "",
  });

  useEffect(() => {
    if (editId) {
      const fetchInvoiceToEdit = async () => {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";
          const response = await axios.get(`${apiUrl}/api/invoices/${editId}`);
          const data = response.data;
          
          setInvoiceData({
            customerName: data.customerName,
            invoiceNumber: data.invoiceNumber,
            date: dayjs(data.date).format("YYYY-MM-DD"),
            projectName: data.projectName || "",
            referenceNumber: data.referenceNumber || "",
            shop: data.shop || "SZ SIGNAGE",
            invoiceType: data.invoiceType || "Signage Work",
            format: data.format || "INVOICE",
          });
          
          setRows(data.rows || []);
          setIsOldLayout(data.layoutMode === "old");
        } catch (err) {
          console.error("Failed to fetch invoice for editing:", err);
          alert("Failed to load the selected invoice for editing.");
        }
      };
      fetchInvoiceToEdit();
    }
  }, [editId]);

  const handleInvoiceSave = () => {
    setRows([]); // Clear previous data
    setOpenInvoiceModal(false);
  };

  const handleInvoiceEditSave = () => {
    setOpenInvoiceEditModal(false);
  };

  const handleDelete = (id: number) => {
    const updated = rows
      .filter((row) => row.id !== id)
      .map((row, index) => ({
        ...row,
        sNo: index + 1,
        id: index + 1,
      }));
    setRows(updated);
  };

  const totalAmount = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.amount, 0);
  }, [rows]);

  // Parser to auto calculate area from size (e.g. 3x5 or 3 * 5)
  const parseSizeToArea = (sizeStr: string): number | null => {
    const regex = /^\s*(\d+(?:\.\d+)?)\s*[\*xX]\s*(\d+(?:\.\d+)?)\s*$/;
    const match = sizeStr.match(regex);
    if (match) {
      const w = parseFloat(match[1]);
      const h = parseFloat(match[2]);
      return w * h;
    }
    return null;
  };

  // Live amount calculation for current newItem state
  const computedAmount = useMemo(() => {
    if (isOldLayout) {
      const qty = newItem.quantity === "" ? 0 : Number(newItem.quantity);
      const rate = newItem.rate === "" ? 0 : Number(newItem.rate);
      return qty * rate;
    }
    if (newItem.type === "Other") {
      return newItem.amount === "" ? 0 : newItem.amount;
    }
    const qty = newItem.quantity === "" ? 1 : newItem.quantity;
    const area = newItem.area === "" ? 0 : newItem.area;
    const rate = newItem.rate === "" ? 0 : newItem.rate;

    if (newItem.unit === "Sq.ft") {
      return qty * area * rate;
    } else {
      const actualQty = newItem.quantity === "" ? 0 : newItem.quantity;
      return actualQty * rate;
    }
  }, [newItem.type, newItem.unit, newItem.area, newItem.quantity, newItem.rate, newItem.amount, isOldLayout]);

  // Validation rules
  const isItemFormValid = useMemo(() => {
    if (!newItem.description.trim()) return false;

    if (isOldLayout) {
      return (
        newItem.quantity !== "" && newItem.quantity > 0 &&
        newItem.rate !== "" && newItem.rate > 0
      );
    }

    if (newItem.type === "Other") {
      return newItem.amount !== "" && newItem.amount > 0;
    }

    if (newItem.rate === "" || newItem.rate <= 0) return false;

    if (newItem.unit === "Sq.ft") {
      return newItem.area !== "" && newItem.area > 0;
    } else {
      return newItem.quantity !== "" && newItem.quantity > 0;
    }
  }, [newItem, isOldLayout]);

  // Columns definition (Memoized to prevent recreation on every render)
  const columns: GridColDef[] = useMemo(() => {
    const baseColumns = [
      { field: "sNo", headerName: "S. No", width: 70 },
      { field: "description", headerName: "Description", flex: 1 },
    ];

    if (isOldLayout) {
      return [
        ...baseColumns,
        {
          field: "quantity",
          headerName: "Quantity",
          width: 100,
          valueFormatter: (value: any) => (value === 0 || !value ? "-" : value),
        },
        {
          field: "rate",
          headerName: "Rate",
          width: 120,
          align: "right",
          headerAlign: "right",
          valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
        },
        {
          field: "amount",
          headerName: "Amount",
          width: 130,
          align: "right",
          headerAlign: "right",
          valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
        },
        {
          field: "actions",
          headerName: "Actions",
          width: 110,
          renderCell: (params) => (
            <Box display="flex" gap={0.5}>
              <IconButton onClick={() => handleEdit(params)}>
                <EditIcon color="primary" fontSize="small" />
              </IconButton>
              <IconButton onClick={() => handleDelete(params.row.id)}>
                <DeleteIcon color="error" fontSize="small" />
              </IconButton>
            </Box>
          ),
        },
      ];
    }

    return [
      ...baseColumns,
      {
        field: "boardThickness",
        headerName: "Board Thickness",
        width: 130,
        valueFormatter: (value: any) => (value === "" || !value ? "-" : value),
      },
      {
        field: "size",
        headerName: "Size",
        width: 90,
        valueFormatter: (value: any) => (value === "" || !value ? "-" : value),
      },
      {
        field: "unit",
        headerName: "Unit",
        width: 90,
        valueFormatter: (value: any) => (value === "" || !value ? "-" : value),
      },
      {
        field: "area",
        headerName: "Area (Sq.ft)",
        width: 100,
        valueFormatter: (value: any) => (value === 0 || !value ? "-" : value),
      },
      {
        field: "type",
        headerName: "Type",
        width: 100,
        valueFormatter: (value: any) => (value === "" || !value ? "-" : value),
      },
      {
        field: "quantity",
        headerName: "Quantity",
        width: 90,
        valueFormatter: (value: any) => (value === 0 || !value ? "-" : value),
      },
      {
        field: "rate",
        headerName: "Rate",
        width: 110,
        align: "right",
        headerAlign: "right",
        valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 120,
        align: "right",
        headerAlign: "right",
        valueFormatter: (value: any) => formatCurrency(Number(value || 0)),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 110,
        renderCell: (params) => (
          <Box display="flex" gap={0.5}>
            <IconButton onClick={() => handleEdit(params)}>
              <EditIcon color="primary" fontSize="small" />
            </IconButton>
            <IconButton onClick={() => handleDelete(params.row.id)}>
              <DeleteIcon color="error" fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ];
  }, [rows, isOldLayout]);

  const handleDownload = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5050";
      let savedDoc;

      if (editId) {
        // Update existing invoice
        const response = await axios.put(`${apiUrl}/api/invoices/${editId}`, {
          ...invoiceData,
          layoutMode: isOldLayout ? "old" : "new",
          rows,
          totalAmount,
        });
        savedDoc = response.data;
        setToastMessage("Invoice updated successfully!");
      } else {
        // Create new invoice
        const response = await axios.post(`${apiUrl}/api/invoices`, {
          ...invoiceData,
          layoutMode: isOldLayout ? "old" : "new",
          rows,
          totalAmount,
        });
        savedDoc = response.data;
        setToastMessage("Saved to database successfully!");
      }

      setInvoiceData((prev) => ({
        ...prev,
        invoiceNumber: savedDoc.invoiceNumber,
      }));
      setToastSeverity("success");
      setToastOpen(true);
      generateInvoicePDF(rows, totalAmount, {
        ...invoiceData,
        invoiceNumber: savedDoc.invoiceNumber,
      }, isOldLayout ? "old" : "new");

      if (editId) {
        // Clear edit query param after successful save to return to creation mode
        setSearchParams({});
      }
    } catch (err) {
      console.error("Failed to save invoice to MongoDB:", err);
      setToastMessage(editId ? "Failed to update invoice in database." : "Failed to save invoice to database.");
      setToastSeverity("error");
      setToastOpen(true);

      const confirmDownload = window.confirm(
        editId
          ? "Warning: Failed to update the invoice in the database. Do you want to download the PDF anyway?"
          : "Warning: Failed to save the invoice to the database. This transaction will NOT be saved to your history. Do you want to download the PDF anyway?"
      );
      if (confirmDownload) {
        generateInvoicePDF(rows, totalAmount, invoiceData, isOldLayout ? "old" : "new");
      }
    }
  };

  // Generate 100 Dummy Signage items
  const generateDummyRows = () => {
    const dummyItems: InvoiceItem[] = [];
    for (let i = 1; i <= 100; i++) {
      const unit = UNIT_OPTIONS[Math.floor(Math.random() * UNIT_OPTIONS.length)];
      const boardThickness = THICKNESS_OPTIONS[Math.floor(Math.random() * THICKNESS_OPTIONS.length)];
      const type = TYPE_OPTIONS[Math.floor(Math.random() * TYPE_OPTIONS.length)];
      const size = `${Math.floor(Math.random() * 12) + 2}x${Math.floor(Math.random() * 10) + 2}`;
      
      const area = unit === "Sq.ft" ? Math.floor(Math.random() * 80) + 10 : 0;
      const quantity = Math.floor(Math.random() * 15) + 1;
      const rate = Math.floor(Math.random() * 450) + 50;
      const amount = unit === "Sq.ft" ? quantity * area * rate : quantity * rate;

      dummyItems.push({
        id: i,
        sNo: i,
        description: `Custom ${type} ${boardThickness !== "Other" ? boardThickness : ""} Board Printing`,
        boardThickness,
        size,
        unit,
        area,
        type,
        quantity,
        rate,
        amount,
      });
    }
    setRows(dummyItems);
  };

  // Helper to format string to Title Case (first letter of each word capitalized)
  const toTitleCase = (str: string): string => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleAddItem = () => {
    const qty = newItem.quantity === "" ? 0 : newItem.quantity;
    const area = newItem.area === "" ? 0 : newItem.area;
    const rate = newItem.rate === "" ? 0 : newItem.rate;
    
    let amount = 0;
    if (newItem.type === "Other") {
      amount = newItem.amount === "" ? 0 : newItem.amount;
    } else {
      const factorQty = newItem.unit === "Sq.ft" ? (qty === 0 ? 1 : qty) : qty;
      amount = newItem.unit === "Sq.ft" ? factorQty * area * rate : factorQty * rate;
    }

    const formattedDescription = toTitleCase(newItem.description);

    if (editingRowId !== null) {
      // Update existing row
      setRows((prev) =>
        prev.map((row) =>
          row.id === editingRowId
            ? {
                ...row,
                description: formattedDescription,
                boardThickness: newItem.boardThickness,
                size: newItem.size,
                unit: newItem.unit,
                area: area,
                type: newItem.type,
                quantity: qty,
                rate: rate,
                amount: amount,
              }
            : row
        )
      );
      setEditingRowId(null);
    } else {
      // Add new row
      setRows((prev) => [
        ...prev,
        {
          id: prev.length > 0 ? Math.max(...prev.map((r) => r.id)) + 1 : 1,
          sNo: prev.length + 1,
          description: formattedDescription,
          boardThickness: newItem.boardThickness,
          size: newItem.size,
          unit: newItem.unit,
          area: area,
          type: newItem.type,
          quantity: qty,
          rate: rate,
          amount: amount,
        },
      ]);
    }

    // Reset form
    setNewItem({
      description: "",
      boardThickness: "",
      size: "",
      unit: "",
      area: "",
      type: "",
      quantity: 1,
      rate: "",
      amount: "",
    });
    setShowCustomType(false);
    setCustomTypeInput("");
    setOpenAddModal(false);
  };

  const handleEdit = (params: any) => {
    const row = params.row as InvoiceItem;
    setEditingRowId(row.id);

    const isStandardType = TYPE_OPTIONS.includes(row.type);
    setShowCustomType(!isStandardType && row.type !== "");
    setCustomTypeInput(isStandardType ? "" : row.type);

    setNewItem({
      description: row.description,
      boardThickness: row.boardThickness,
      size: row.size,
      unit: row.unit,
      area: row.area === 0 ? "" : row.area,
      type: row.type,
      quantity: row.quantity === 0 ? "" : row.quantity,
      rate: row.rate === 0 ? "" : row.rate,
      amount: row.amount,
    });
    setOpenAddModal(true);
  };

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
      {/* Top action header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ borderBottom: "1px solid #eaeaea", pb: 2 }}
      >
        <Box>
          <Typography variant="h5" fontWeight="bold" color="text.primary">
            Signage Invoicing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage ACP, Acrylic, Vinyl, and LED boards pricing worksheets
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2.5}>
          <Tabs
            value={isOldLayout ? 1 : 0}
            onChange={(e, newValue) => setIsOldLayout(newValue === 1)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="New Layout" sx={{ fontWeight: "bold", fontSize: "13px" }} />
            <Tab label="Old Layout" sx={{ fontWeight: "bold", fontSize: "13px" }} />
          </Tabs>
          <Button
            variant="outlined"
            startIcon={<NoteAddIcon />}
            onClick={() => setOpenInvoiceModal(true)}
          >
            New Invoice
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={
              !invoiceData.customerName ||
              !invoiceData.date
            }
            onClick={() => {
              setEditingRowId(null);
              setNewItem({
                description: "",
                boardThickness: "3 mm",
                size: "",
                unit: "Nos",
                area: "",
                type: "ACP",
                quantity: 1,
                rate: "",
              });
              setOpenAddModal(true);
            }}
          >
            Add Item
          </Button>
        </Box>
      </Box>

      {/* Invoice Details Card */}
      <Box
        sx={{
          border: "1px solid #e0e0e0",
          borderRadius: 3,
          padding: 3,
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          position: "relative",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 3,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Customer Name
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.customerName || "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Invoice Number
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.invoiceNumber || "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Date
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.date ? dayjs(invoiceData.date).format("DD MMMM YYYY") : "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Project Name
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.projectName || "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Reference Number
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.referenceNumber || "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Shop
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.shop || "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Invoice Type
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
            {invoiceData.invoiceType || "-"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ textTransform: "uppercase" }}>
            Invoice / Quotation
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: "bold",
              mt: 0.5,
              color: invoiceData.format === "INVOICE" ? "#22b378" : "#ff9800",
            }}
          >
            {invoiceData.format || "-"}
          </Typography>
        </Box>

        <IconButton
          onClick={() => setOpenInvoiceEditModal(true)}
          title="Edit Invoice Details"
          sx={{ position: "absolute", top: 12, right: 12, backgroundColor: "#f5f5f7", "&:hover": { backgroundColor: "#e8e8ed" } }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Main Table Area */}
      <Box
        sx={{
          height: "55vh",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: 3,
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          disableColumnMenu
          hideFooter
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

      {/* Summary Footer bar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#ffffff",
          padding: 2.5,
          borderRadius: 3,
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <Box>
          <FormControl component="fieldset">
            <RadioGroup
              row
              value={invoiceData.shop}
              onChange={(e) =>
                setInvoiceData({ ...invoiceData, shop: e.target.value })
              }
            >
              <FormControlLabel
                value="SZ SIGNAGE"
                control={<Radio size="small" />}
                label={<Typography sx={{ fontSize: "14px", fontWeight: 500 }}>SZ SIGNAGE</Typography>}
              />
              <FormControlLabel
                value="STICKER ZONE"
                control={<Radio size="small" />}
                label={<Typography sx={{ fontSize: "14px", fontWeight: 500 }}>STICKER ZONE</Typography>}
              />
            </RadioGroup>
          </FormControl>
        </Box>
        
        <Box display="flex" alignItems="center" gap={4}>
          <Typography variant="h6" fontWeight="bold" sx={{ color: "text.primary" }}>
            Total: <span style={{ color: "#1E1E2D" }}>{formatCurrency(totalAmount)}</span>
          </Typography>
          {editId && (
            <Button
              variant="outlined"
              color="warning"
              onClick={() => {
                setSearchParams({});
                setInvoiceData({
                  customerName: "",
                  invoiceNumber: "",
                  date: "",
                  projectName: "",
                  referenceNumber: "",
                  shop: "SZ SIGNAGE",
                  invoiceType: "Signage Work",
                  format: "INVOICE",
                });
                setRows([]);
              }}
              sx={{ px: 3, py: 1, borderRadius: 2, textTransform: "none", fontSize: "15px", fontWeight: "bold" }}
            >
              Cancel Edit
            </Button>
          )}
          <Button
            variant="contained"
            color="success"
            disabled={rows.length === 0}
            onClick={handleDownload}
            sx={{ px: 4, py: 1, borderRadius: 2, textTransform: "none", fontSize: "15px", fontWeight: "bold" }}
          >
            {editId ? "Update & Download PDF" : "Download PDF"}
          </Button>
        </Box>
      </Box>

      {/* Modal: Create Invoice */}
      <Dialog
        open={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        PaperProps={{
          sx: {
            width: "600px",
            borderRadius: 3,
            padding: 1.5,
          },
        }}
      >
        <DialogTitle fontWeight="bold">Create New Invoice</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            paddingTop: 1.5,
          }}
        >
          <Box display="flex" gap={2}>
            <FormControl fullWidth>
              <InputLabel id="create-format-label">Invoice / Quotation</InputLabel>
              <Select
                labelId="create-format-label"
                label="Invoice / Quotation"
                value={invoiceData.format}
                onChange={(e) => setInvoiceData({ ...invoiceData, format: e.target.value })}
              >
                <MenuItem value="INVOICE">INVOICE</MenuItem>
                <MenuItem value="QUOTATION">QUOTATION</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="create-shop-label">Shop Office</InputLabel>
              <Select
                labelId="create-shop-label"
                label="Shop Office"
                value={invoiceData.shop}
                onChange={(e) => setInvoiceData({ ...invoiceData, shop: e.target.value })}
              >
                <MenuItem value="SZ SIGNAGE">SZ SIGNAGE</MenuItem>
                <MenuItem value="STICKER ZONE">STICKER ZONE</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Customer Name"
            fullWidth
            value={invoiceData.customerName}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, customerName: e.target.value })
            }
          />

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Date"
              value={invoiceData.date ? dayjs(invoiceData.date) : null}
              onChange={(newValue) =>
                setInvoiceData({
                  ...invoiceData,
                  date: newValue?.format("YYYY-MM-DD") || "",
                })
              }
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>

          <TextField
            label="Project Name"
            fullWidth
            value={invoiceData.projectName}
            onChange={(e) => setInvoiceData({ ...invoiceData, projectName: e.target.value })}
          />

          <Box display="flex" gap={2}>
            <TextField
              label="Reference Number"
              fullWidth
              value={invoiceData.referenceNumber}
              onChange={(e) => setInvoiceData({ ...invoiceData, referenceNumber: e.target.value })}
            />
            <TextField
              label="Invoice Type"
              fullWidth
              value={invoiceData.invoiceType}
              onChange={(e) => setInvoiceData({ ...invoiceData, invoiceType: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenInvoiceModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvoiceSave} disabled={!invoiceData.customerName || !invoiceData.date}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Edit Invoice Details */}
      <Dialog
        open={openInvoiceEditModal}
        onClose={() => setOpenInvoiceEditModal(false)}
        PaperProps={{
          sx: {
            width: "600px",
            borderRadius: 3,
            padding: 1.5,
          },
        }}
      >
        <DialogTitle fontWeight="bold">Edit Invoice Details</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2.5,
            paddingTop: 1.5,
          }}
        >
          <Box display="flex" gap={2}>
            <FormControl fullWidth>
              <InputLabel id="edit-format-label">Invoice / Quotation</InputLabel>
              <Select
                labelId="edit-format-label"
                label="Invoice / Quotation"
                value={invoiceData.format}
                onChange={(e) => setInvoiceData({ ...invoiceData, format: e.target.value })}
              >
                <MenuItem value="INVOICE">INVOICE</MenuItem>
                <MenuItem value="QUOTATION">QUOTATION</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="edit-shop-label">Shop Office</InputLabel>
              <Select
                labelId="edit-shop-label"
                label="Shop Office"
                value={invoiceData.shop}
                onChange={(e) => setInvoiceData({ ...invoiceData, shop: e.target.value })}
              >
                <MenuItem value="SZ SIGNAGE">SZ SIGNAGE</MenuItem>
                <MenuItem value="STICKER ZONE">STICKER ZONE</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Customer Name"
            fullWidth
            value={invoiceData.customerName}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, customerName: e.target.value })
            }
          />

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label="Date"
              value={invoiceData.date ? dayjs(invoiceData.date) : null}
              onChange={(newValue) =>
                setInvoiceData({
                  ...invoiceData,
                  date: newValue?.format("YYYY-MM-DD") || "",
                })
              }
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>

          <TextField
            label="Project Name"
            fullWidth
            value={invoiceData.projectName}
            onChange={(e) => setInvoiceData({ ...invoiceData, projectName: e.target.value })}
          />

          <Box display="flex" gap={2}>
            <TextField
              label="Reference Number"
              fullWidth
              value={invoiceData.referenceNumber}
              onChange={(e) => setInvoiceData({ ...invoiceData, referenceNumber: e.target.value })}
            />
            <TextField
              label="Invoice Type"
              fullWidth
              value={invoiceData.invoiceType}
              onChange={(e) => setInvoiceData({ ...invoiceData, invoiceType: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenInvoiceEditModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvoiceEditSave}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Add/Edit Item */}
      <Dialog
        open={openAddModal}
        onClose={() => {
          setOpenAddModal(false);
          setEditingRowId(null);
        }}
        PaperProps={{
          sx: {
            width: "650px",
            borderRadius: 3,
            padding: 1.5,
          },
        }}
      >
        <DialogTitle fontWeight="bold">
          {editingRowId !== null ? "Edit Signage Item" : "Add Signage Item"}
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          {isOldLayout ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                pt: 1,
              }}
            >
              <DynamicAutocomplete
                label="Description *"
                value={newItem.description}
                onChange={(val) => setNewItem((prev) => ({ ...prev, description: val }))}
              />
              <TextField
                label="Quantity *"
                type="number"
                fullWidth
                value={newItem.quantity}
                onChange={(e) => {
                  const parsed = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setNewItem((prev) => ({ ...prev, quantity: parsed }));
                }}
              />
              <TextField
                label="Rate (INR) *"
                type="number"
                fullWidth
                value={newItem.rate}
                onChange={(e) => {
                  const parsed = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setNewItem((prev) => ({ ...prev, rate: parsed }));
                }}
              />
              <TextField
                label="Amount"
                fullWidth
                value={formatCurrency(computedAmount)}
                InputProps={{
                  readOnly: true,
                }}
              />
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2.5,
                pt: 1,
              }}
            >
              <Box sx={{ gridColumn: { xs: "span 1", sm: "span 2" } }}>
                <DynamicAutocomplete
                  label="Description *"
                  value={newItem.description}
                  onChange={(val) => setNewItem((prev) => ({ ...prev, description: val }))}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel id="thickness-select-label">Board Thickness</InputLabel>
                <Select
                  labelId="thickness-select-label"
                  label="Board Thickness"
                  value={newItem.boardThickness}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, boardThickness: e.target.value }))}
                >
                  {THICKNESS_OPTIONS.map((thickness) => (
                    <MenuItem key={thickness} value={thickness}>
                      {thickness === "" ? "—" : thickness}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Size"
                placeholder="e.g. 3x5"
                fullWidth
                value={newItem.size}
                onChange={(e) => {
                  const newSize = e.target.value;
                  setNewItem((prev) => {
                    const updated = { ...prev, size: newSize };
                    const calculatedArea = parseSizeToArea(newSize);
                    if (calculatedArea !== null) {
                      updated.area = calculatedArea;
                    }
                    return updated;
                  });
                }}
              />

              <FormControl fullWidth>
                <InputLabel id="unit-select-label">Unit</InputLabel>
                <Select
                  labelId="unit-select-label"
                  label="Unit"
                  value={newItem.unit}
                  onChange={(e) => {
                    const unitVal = e.target.value;
                    setNewItem((prev) => ({
                      ...prev,
                      unit: unitVal,
                    }));
                  }}
                >
                  {UNIT_OPTIONS.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {unit === "" ? "—" : unit}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {showCustomType ? (
                <TextField
                  label="Custom Type *"
                  fullWidth
                  value={customTypeInput}
                  onChange={(e) => {
                    setCustomTypeInput(e.target.value);
                    setNewItem((prev) => ({ ...prev, type: e.target.value }));
                  }}
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setShowCustomType(false);
                          setCustomTypeInput("");
                          setNewItem((prev) => ({ ...prev, type: "" }));
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ),
                  }}
                />
              ) : (
                <FormControl fullWidth>
                  <InputLabel id="type-select-label">Type</InputLabel>
                  <Select
                    labelId="type-select-label"
                    label="Type"
                    value={TYPE_OPTIONS.includes(newItem.type) ? newItem.type : (newItem.type ? "Custom" : "")}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      if (selectedVal === "Custom") {
                        setShowCustomType(true);
                        setCustomTypeInput("");
                        setNewItem((prev) => ({ ...prev, type: "" }));
                      } else {
                        setNewItem((prev) => ({ ...prev, type: selectedVal }));
                      }
                    }}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t === "" ? "—" : t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <TextField
                label={newItem.type === "Other" ? "Area (Sq.ft)" : (newItem.unit === "Sq.ft" ? "Area (Sq.ft) *" : "Area (Sq.ft)")}
                type="number"
                fullWidth
                value={newItem.area}
                onChange={(e) => {
                  const parsed = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setNewItem((prev) => ({ ...prev, area: parsed }));
                }}
              />

              <TextField
                label={newItem.type === "Other" ? "Quantity" : (newItem.unit !== "Sq.ft" ? "Quantity *" : "Quantity")}
                type="number"
                fullWidth
                value={newItem.quantity}
                onChange={(e) => {
                  const parsed = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setNewItem((prev) => ({ ...prev, quantity: parsed }));
                }}
              />

              <TextField
                label={newItem.type === "Other" ? "Rate (INR)" : "Rate (INR) *"}
                type="number"
                fullWidth
                value={newItem.rate}
                onChange={(e) => {
                  const parsed = e.target.value === "" ? "" : parseFloat(e.target.value);
                  setNewItem((prev) => ({ ...prev, rate: parsed }));
                }}
              />

              <TextField
                label={newItem.type === "Other" ? "Amount *" : "Amount"}
                type={newItem.type === "Other" ? "number" : "text"}
                fullWidth
                value={newItem.type === "Other" ? newItem.amount : formatCurrency(computedAmount)}
                InputProps={{
                  readOnly: newItem.type !== "Other",
                }}
                onChange={(e) => {
                  if (newItem.type === "Other") {
                    const val = e.target.value === "" ? "" : parseFloat(e.target.value);
                    setNewItem((prev) => ({ ...prev, amount: val }));
                  }
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setOpenAddModal(false);
              setEditingRowId(null);
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddItem} disabled={!isItemFormValid}>
            Save Item
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setToastOpen(false)} severity={toastSeverity} sx={{ width: "100%" }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InvoicePage;
