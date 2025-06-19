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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useState } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import DynamicAutocomplete from "./AutosuggestionTextFields";
import { generateInvoicePDF } from "../utils/printer";
const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const InvoicePage = () => {
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openInvoiceEditModal, setOpenInvoiceEditModal] = useState(false);

  const [openAddModal, setOpenAddModal] = useState(false);
  const [rows, setRows] = useState([]);
  const [editingRowId, setEditingRowId] = useState(null);
  console.log("rows", rows);
  const [invoiceData, setInvoiceData] = useState({
    customerName: "",
    invoiceNumber: "",
    date: "",
    shop: "SZ SIGNAGE",
    format:"INVOICE"
  });

  const [newItem, setNewItem] = useState({
    description: "",
    quantity: 0,
    price: 0,
  });

  const handleInvoiceSave = () => {
    setRows([]); // Clear previous data
    setOpenInvoiceModal(false);
  };
  const handleInvoiceEditSave = () => {
    setOpenInvoiceEditModal(false);
  };

  const handleAddItem = () => {
    const amount = newItem.quantity * newItem.price;

    if (editingRowId !== null) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === editingRowId
            ? {
                ...row,
                description: newItem.description,
                quantity: newItem.quantity,
                price: newItem.price,
                amount,
              }
            : row
        )
      );
      setEditingRowId(null);
    } else {
      setRows([
        ...rows,
        {
          id: rows.length + 1,
          sNo: rows.length + 1,
          description: newItem.description,
          quantity: newItem.quantity,
          price: newItem.price,
          amount,
        },
      ]);
    }

    setNewItem({ description: "", quantity: 0, price: 0 });
    setOpenAddModal(false);
  };

  const handleEdit = (row) => {
    setEditingRowId(row.id);
    setNewItem({
      description: row.description,
      quantity: row.quantity,
      price: row.price,
    });
    setOpenAddModal(true);
  };

  const handleDelete = (id) => {
    const updated = rows
      .filter((row) => row.id !== id)
      .map((row, index) => ({
        ...row,
        sNo: index + 1,
        id: index + 1,
      }));
    setRows(updated);
  };

  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  const columns = [
    { field: "sNo", headerName: "S. No", width: 80 },
    { field: "description", headerName: "Description", flex: 1 },
    { field: "quantity", headerName: "Quantity", width: 150 },
    {
      field: "price",
      headerName: "Price",
      width: 150,
      valueFormatter: (params) => formatCurrency(params),
    },
    {
      field: "amount",
      headerName: "Amount",
      width: 150,
      valueFormatter: (params) => formatCurrency(params),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      renderCell: (params) => (
        <>
          <IconButton onClick={() => handleEdit(params)}>
            <EditIcon color="primary" />
          </IconButton>
          <IconButton onClick={() => handleDelete(params.row.id)}>
            <DeleteIcon color="error" />
          </IconButton>
        </>
      ),
    },
  ];

  const handleDownload = () => {
    generateInvoicePDF(rows, totalAmount, invoiceData);
  };

  // Function to generate 100 dummy items
  const generateDummyRows = () => {
    const dummyItems = [];
    for (let i = 1; i <= 100; i++) {
      const quantity = Math.floor(Math.random() * 10) + 1;
      const price = Math.floor(Math.random() * 1000) + 100;
      const amount = quantity * price;

      dummyItems.push({
        sNo: i,
        description: `Product ${i}`,
        quantity: quantity,
        price: price,
        amount: amount,
      });
    }
    return dummyItems;
  };

  // Generate and calculate total

  // Use in download handler
  // const handleDownload = () => {
  //   // Dummy invoiceData
  //   const invoiceData = {
  //     invoiceNumber: "INV-1001",
  //     customerName: "john doe",
  //     date: new Date().toISOString(), // current date
  //   };

  //   const rows = generateDummyRows();
  //   const totalAmount = rows.reduce((acc, item) => acc + item.amount, 0);
  //   generateInvoicePDF(rows, totalAmount, invoiceData);
  // };

  return (
    <Box
      sx={{
        padding: 2,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box
        display="flex"
        gap={2}
        sx={{ display: "flex", justifyContent: "flex-end" }}
      >
        <Button
          variant="outlined"
          startIcon={<NoteAddIcon />}
          onClick={() => setOpenInvoiceModal(true)}
        >
          Create New Invoice
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={
            !invoiceData.customerName ||
            !invoiceData.invoiceNumber ||
            !invoiceData.date
          }
          onClick={() => setOpenAddModal(true)}
        >
          Add
        </Button>
      </Box>
      {/* Header Info */}

      <Box
        sx={{
          border: "1px solid #e0e0e0",
          borderRadius: 2,
          padding: 2,

          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Customer Name
          </Typography>
          <Typography gutterBottom>{invoiceData.customerName}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Invoice Number
          </Typography>
          <Typography gutterBottom>{invoiceData.invoiceNumber}</Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Date
          </Typography>
          <Typography>{invoiceData.date}</Typography>
        </Box>
        <IconButton
          onClick={() => setOpenInvoiceEditModal(true)}
          title="Edit Invoice Info"
          sx={{ alignSelf: "flex-start" }}
        >
          <EditIcon />
        </IconButton>
      </Box>
      <Box
        sx={{
          width: "100%",

          height: "50px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
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
              control={<Radio />}
              label={
                <Typography sx={{ fontSize: "13px" }}>SZ SIGNAGE</Typography>
              }
            />
            <FormControlLabel
              value="STICKER ZONE"
              control={<Radio />}
              label={
                <Typography sx={{ fontSize: "13px" }}>STICKER ZONE</Typography>
              }
            />
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Table */}
      <Box
        sx={{
          height: "80vh",
          width: "100%",
          marginBottom: 2,
          overflow: "scroll",
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          disableColumnMenu
          hideFooter
          sx={{
            "& .MuiDataGrid-columnHeader": {
              backgroundColor: "#1E1E2D",
              color: "white",
            },
            "& .MuiDataGrid-cell": {
              border: "none",
            },
          }}
        />
      </Box>

      {/* Total */}

      <Box
        sx={{
          height: "10vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
        }}
      >
        <Typography variant="h6">
          Total: {formatCurrency(totalAmount)}
        </Typography>
        <Button disabled={rows.length === 0} onClick={() => handleDownload()}>
          Download
        </Button>
      </Box>

      {/* Modal: Invoice */}
      <Dialog
        open={openInvoiceModal}
        onClose={() => setOpenInvoiceModal(false)}
        PaperProps={{
          sx: {
            width: "600px", // Adjust width as needed
            height: "400px", // Adjust height as needed
            padding: 2,
          },
        }}
      >
        <DialogTitle>Create New Invoice</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            paddingTop: 2,
          }}
        >
          <Box />
          <TextField
            label="Customer Name"
            fullWidth
            value={invoiceData.customerName}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, customerName: e.target.value })
            }
          />
          <TextField
            label="Invoice Number"
            fullWidth
            value={invoiceData.invoiceNumber}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInvoiceModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvoiceSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      {/* Edit: Customer deatils */}
      <Dialog
        open={openInvoiceEditModal}
        onClose={() => setOpenInvoiceEditModal(false)}
        PaperProps={{
          sx: {
            width: "600px", // Adjust width as needed
            height: "400px", // Adjust height as needed
            padding: 2,
          },
        }}
      >
        <DialogTitle>Edit Invoice</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            paddingTop: 2,
          }}
        >
          <Box />
          <TextField
            label="Customer Name"
            fullWidth
            value={invoiceData.customerName}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, customerName: e.target.value })
            }
          />
          <TextField
            label="Invoice Number"
            fullWidth
            value={invoiceData.invoiceNumber}
            onChange={(e) =>
              setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenInvoiceEditModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleInvoiceEditSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      {/* Modal: Add/Edit Item */}
      <Dialog
        open={openAddModal}
        onClose={() => setOpenAddModal(false)}
        PaperProps={{
          sx: {
            width: "600px", // Adjust width as needed
            height: "400px", // Adjust height as needed
            padding: 2,
          },
        }}
      >
        <DialogTitle>{editingRowId ? "Edit Item" : "Add Item"}</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            paddingTop: 2,
          }}
        >
          <Box />

          <DynamicAutocomplete
            label="Description"
            value={newItem.description}
            onChange={(val) => setNewItem({ ...newItem, description: val })}
          />
          <TextField
            label="Quantity"
            type="number"
            fullWidth
            value={newItem.quantity}
            onChange={(e) =>
              setNewItem({ ...newItem, quantity: parseFloat(e.target.value) })
            }
          />
          <TextField
            label="Price"
            type="number"
            fullWidth
            value={newItem.price}
            onChange={(e) =>
              setNewItem({ ...newItem, price: parseFloat(e.target.value) })
            }
          />
          <Typography>
            Amount:{" "}
            {formatCurrency((newItem.quantity * newItem.price).toFixed(2))}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddItem}
            disabled={
              !newItem.description || !newItem.quantity || !newItem.price
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoicePage;
