import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Theme } from "../theme";
import { API_URL } from "../config";
import { InvoiceData, InvoiceItem } from "../types";
import { exportInvoicePDF, exportInvoiceExcel } from "../utils/exporters";

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
const SHOPS = ["SZ SIGNAGE", "STICKER ZONE"];
const INVOICE_TYPES = ["Signage Work", "Sticker Work", "Printing Work"];
const FORMATS = ["INVOICE", "QUOTATION"];

const formatCurrency = (val: number) => {
  return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function InvoiceScreen({ navigation, route, onOpenMenu }: any) {
  const editingInvoice = route?.params?.invoice;

  // Layout Mode ("new" = 10 cols, "old" = 5 cols)
  const [layoutMode, setLayoutMode] = useState<"new" | "old">("new");

  // Metadata Form State
  const [format, setFormat] = useState<"INVOICE" | "QUOTATION">("INVOICE");
  const [shop, setShop] = useState("SZ SIGNAGE");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [invoiceType, setInvoiceType] = useState("Signage Work");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  
  // Rows list
  const [rows, setRows] = useState<InvoiceItem[]>([]);

  // Modals & UI States
  const [loading, setLoading] = useState(false);
  const [metadataModalVisible, setMetadataModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Selector Pickers Modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerOptions, setPickerOptions] = useState<string[]>([]);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerTarget, setPickerTarget] = useState<"thickness" | "unit" | "type" | "invoiceType" | "shop" | "format" | null>(null);

  // New Item State
  const [itemDesc, setItemDesc] = useState("");
  const [itemThickness, setItemThickness] = useState("");
  const [itemSize, setItemSize] = useState("");
  const [itemUnit, setItemUnit] = useState("Nos");
  const [itemArea, setItemArea] = useState("");
  const [itemType, setItemType] = useState("ACP");
  const [showCustomType, setShowCustomType] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemRate, setItemRate] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(dayjs(selectedDate).format("YYYY-MM-DD"));
    }
  };

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

  // Live amount calculation for current newItem state (1:1 with desktop useMemo)
  const computedAmount = () => {
    if (layoutMode === "old") {
      const qty = itemQty === "" ? 0 : parseFloat(itemQty);
      const rate = itemRate === "" ? 0 : parseFloat(itemRate);
      return qty * rate;
    }
    if (itemType === "Other") {
      return itemAmount === "" ? 0 : parseFloat(itemAmount);
    }
    const qty = itemQty === "" ? 1 : parseFloat(itemQty);
    const area = itemArea === "" ? 0 : parseFloat(itemArea);
    const rate = itemRate === "" ? 0 : parseFloat(itemRate);

    if (itemUnit === "Sq.ft") {
      return qty * area * rate;
    } else {
      const actualQty = itemQty === "" ? 0 : parseFloat(itemQty);
      return actualQty * rate;
    }
  };

  // Validation rules (1:1 with desktop isItemFormValid)
  const isItemFormValid = () => {
    if (!itemDesc.trim()) return false;

    if (layoutMode === "old") {
      const qty = parseFloat(itemQty);
      const rate = parseFloat(itemRate);
      return !isNaN(qty) && qty > 0 && !isNaN(rate) && rate > 0;
    }

    if (itemType === "Other") {
      const amt = parseFloat(itemAmount);
      return !isNaN(amt) && amt > 0;
    }

    const rate = parseFloat(itemRate);
    if (isNaN(rate) || rate <= 0) return false;

    if (itemUnit === "Sq.ft") {
      const area = parseFloat(itemArea);
      return !isNaN(area) && area > 0;
    } else {
      const qty = parseFloat(itemQty);
      return !isNaN(qty) && qty > 0;
    }
  };

  // Load next invoice number from server
  const fetchNextInvoiceNumber = async (selectedShop: string, selectedFormat: string) => {
    try {
      const response = await fetch(
        `${API_URL}/api/invoices/next-number?shop=${encodeURIComponent(selectedShop)}&format=${selectedFormat}`
      );
      if (response.ok) {
        const data = await response.json();
        setInvoiceNumber(data.nextNumber);
      }
    } catch (err) {
      console.warn("Failed to fetch next invoice number:", err);
    }
  };

  // Trigger when editing loads, or shop/format changes
  useEffect(() => {
    if (editingInvoice) {
      setFormat(editingInvoice.format);
      setShop(editingInvoice.shop);
      setInvoiceNumber(editingInvoice.invoiceNumber);
      setDate(dayjs(editingInvoice.date).format("YYYY-MM-DD"));
      setCustomerName(editingInvoice.customerName);
      setProjectName(editingInvoice.projectName || "");
      setInvoiceType(editingInvoice.invoiceType || "Signage Work");
      setPaidAmount(editingInvoice.paidAmount || 0);
      setDiscount(editingInvoice.discount || 0);
      setRows(editingInvoice.rows || []);
      setLayoutMode(editingInvoice.layoutMode || "new");
    } else {
      fetchNextInvoiceNumber(shop, format);
    }
  }, [editingInvoice]);

  useEffect(() => {
    if (!editingInvoice) {
      fetchNextInvoiceNumber(shop, format);
    }
  }, [shop, format]);

  // Calculations
  const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const total = Math.max(0, subtotal - discount);
  const balanceDue = Math.max(0, total - paidAmount);

  // Add or edit row
  const handleSaveItem = () => {
    if (!isItemFormValid()) {
      Alert.alert("Error", "Please fill in all required fields correctly.");
      return;
    }

    const qty = itemQty === "" ? 0 : parseFloat(itemQty);
    const area = itemArea === "" ? 0 : parseFloat(itemArea);
    const rate = itemRate === "" ? 0 : parseFloat(itemRate);
    const amount = computedAmount();

    const newItem: InvoiceItem = {
      sNo: editingItemIndex !== null ? rows[editingItemIndex].sNo : rows.length + 1,
      description: itemDesc,
      boardThickness: layoutMode === "new" ? (itemThickness || undefined) : undefined,
      size: layoutMode === "new" ? (itemSize || undefined) : undefined,
      unit: layoutMode === "new" ? itemUnit : "Nos",
      area: layoutMode === "new" ? area : 0,
      type: layoutMode === "new" ? (showCustomType ? customTypeInput : itemType) : "Standard",
      quantity: qty,
      rate: rate,
      amount: amount,
    };

    if (editingItemIndex !== null) {
      const updated = [...rows];
      updated[editingItemIndex] = newItem;
      setRows(updated);
      setEditingItemIndex(null);
    } else {
      setRows([...rows, newItem]);
    }

    resetItemForm();
    setItemModalVisible(false);
  };

  const resetItemForm = () => {
    setItemDesc("");
    setItemThickness("");
    setItemSize("");
    setItemUnit("Nos");
    setItemArea("");
    setItemType("ACP");
    setShowCustomType(false);
    setCustomTypeInput("");
    setItemQty("1");
    setItemRate("");
    setItemAmount("");
  };

  const handleEditItem = (index: number) => {
    const item = rows[index];
    setEditingItemIndex(index);
    setItemDesc(item.description);
    setItemThickness(item.boardThickness || "");
    setItemSize(item.size || "");
    setItemUnit(item.unit !== undefined ? item.unit : "Nos");
    setItemArea(item.area ? item.area.toString() : "");
    
    const isStandardType = TYPE_OPTIONS.includes(item.type || "");
    if (item.type && !isStandardType) {
      setItemType("Custom");
      setShowCustomType(true);
      setCustomTypeInput(item.type);
    } else {
      setItemType(item.type || "ACP");
      setShowCustomType(false);
      setCustomTypeInput("");
    }

    setItemQty(item.quantity ? item.quantity.toString() : "");
    setItemRate(item.rate ? item.rate.toString() : "");
    setItemAmount(item.amount ? item.amount.toString() : "");
    setItemModalVisible(true);
  };

  const handleDeleteItem = (index: number) => {
    Alert.alert("Delete Item", "Are you sure you want to delete this row?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const filtered = rows.filter((_, i) => i !== index).map((r, i) => ({ ...r, sNo: i + 1 }));
          setRows(filtered);
        },
      },
    ]);
  };

  // Submit Invoice to MongoDB Backend
  const handleSaveInvoice = async () => {
    if (!customerName.trim()) {
      Alert.alert("Error", "Please configure the invoice metadata details first.");
      return;
    }
    if (rows.length === 0) {
      Alert.alert("Error", "Please add at least one item row to the billing list.");
      return;
    }

    setLoading(true);
    const invoicePayload = {
      customerName,
      invoiceNumber,
      date: new Date(date).toISOString(),
      projectName,
      shop,
      invoiceType,
      format,
      paidAmount,
      discount,
      rows,
      totalAmount: total,
      layoutMode: layoutMode,
    };

    try {
      const url = editingInvoice ? `${API_URL}/api/invoices/${editingInvoice._id}` : `${API_URL}/api/invoices`;
      const method = editingInvoice ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoicePayload),
      });

      if (res.ok) {
        Alert.alert("Success", editingInvoice ? "Billing record updated!" : "Billing record saved!");
        if (editingInvoice) {
          navigation.goBack();
        } else {
          // Reset form
          setCustomerName("");
          setProjectName("");
          setRows([]);
          setPaidAmount(0);
          setDiscount(0);
          fetchNextInvoiceNumber(shop, format);
        }
      } else {
        const errorMsg = await res.text();
        Alert.alert("Error", errorMsg || "Failed to save invoice record.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to connect to the backend server.");
    } finally {
      setLoading(false);
    }
  };

  // Open Selector list modal
  const openOptionPicker = (title: string, options: string[], target: any) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const handleSelectOption = (option: string) => {
    setPickerVisible(false);
    if (pickerTarget === "thickness") setItemThickness(option);
    else if (pickerTarget === "unit") setItemUnit(option);
    else if (pickerTarget === "type") {
      if (option === "Custom") {
        setShowCustomType(true);
        setCustomTypeInput("");
        setItemType("Custom");
      } else {
        setShowCustomType(false);
        setItemType(option);
      }
    }
    else if (pickerTarget === "invoiceType") setInvoiceType(option);
    else if (pickerTarget === "shop") setShop(option);
    else if (pickerTarget === "format") setFormat(option as any);
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        {/* Top Action Header (1:1 Text matching desktop) */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={onOpenMenu} style={{ padding: 4 }}>
              <Ionicons name="menu" size={24} color="#FFF" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Signage Invoicing</Text>
              <Text style={styles.headerSubtitle}>
                Manage ACP, Acrylic, Vinyl, and LED boards pricing worksheets
              </Text>
            </View>
          </View>
          {editingInvoice && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Layout Selector Tabs & Add buttons (1:1 layout) */}
        <View style={styles.topToolbar}>
          {/* Layout tabs */}
          <View style={styles.layoutTabs}>
            <TouchableOpacity
              style={[styles.layoutTabBtn, layoutMode === "new" && styles.layoutTabBtnActive]}
              onPress={() => setLayoutMode("new")}
            >
              <Text style={[styles.layoutTabText, layoutMode === "new" && styles.layoutTabTextActive]}>
                New Layout
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.layoutTabBtn, layoutMode === "old" && styles.layoutTabBtnActive]}
              onPress={() => setLayoutMode("old")}
            >
              <Text style={[styles.layoutTabText, layoutMode === "old" && styles.layoutTabTextActive]}>
                Old Layout
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick buttons */}
          <View style={styles.toolbarActionButtons}>
            <TouchableOpacity style={styles.btnOutline} onPress={() => setMetadataModalVisible(true)}>
              <Ionicons name="document-text-outline" size={14} color={Theme.colors.primary} />
              <Text style={styles.btnOutlineText}>{customerName ? "Edit Metadata" : "Create Invoice"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSolid, !customerName && { opacity: 0.5 }]}
              disabled={!customerName}
              onPress={() => {
                resetItemForm();
                setItemModalVisible(true);
              }}
            >
              <Ionicons name="add" size={14} color="#FFF" />
              <Text style={styles.btnSolidText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* 1. Invoice Details Card (1:1 with desktop metadata view) */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsCardTitle}>INVOICE METADATA DETAILS</Text>
            
            <View style={styles.detailsGrid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Customer Name</Text>
                <Text style={styles.gridValue}>{customerName || "-"}</Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Invoice Number</Text>
                <Text style={styles.gridValue}>{invoiceNumber || "-"}</Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Date</Text>
                <Text style={styles.gridValue}>{date ? dayjs(date).format("DD MMMM YYYY") : "-"}</Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Project Name</Text>
                <Text style={styles.gridValue}>{projectName || "-"}</Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Shop</Text>
                <Text style={styles.gridValue}>{shop || "-"}</Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Invoice Type</Text>
                <Text style={styles.gridValue}>{invoiceType || "-"}</Text>
              </View>

              <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Invoice / Quotation</Text>
                <Text style={[styles.gridValue, { fontWeight: "bold", color: format === "INVOICE" ? Theme.colors.secondary : Theme.colors.warning }]}>
                  {format || "-"}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.detailsEditBtn} onPress={() => setMetadataModalVisible(true)}>
              <Ionicons name="create-outline" size={16} color={Theme.colors.primary} />
              <Text style={styles.detailsEditBtnText}>Edit Details</Text>
            </TouchableOpacity>
          </View>

          {/* Invoice Items List Header */}
          <Text style={styles.itemsListTitle}>Worksheet Item Rows ({rows.length})</Text>

          {/* Horizontal scrollable spreadsheet table (1:1 with desktop columns) */}
          {rows.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={40} color={Theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No items added to this worksheet. Tap Add Item above.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
              <View style={styles.table}>
                {/* Table Header Row */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { width: 45 }]}>S.No</Text>
                  <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLeft, { width: 160 }]}>Description</Text>
                  {layoutMode === "new" && (
                    <>
                      <Text style={[styles.tableHeaderCell, { width: 85 }]}>Thickness</Text>
                      <Text style={[styles.tableHeaderCell, { width: 75 }]}>Size</Text>
                      <Text style={[styles.tableHeaderCell, { width: 65 }]}>Unit</Text>
                      <Text style={[styles.tableHeaderCell, { width: 65 }]}>Area</Text>
                      <Text style={[styles.tableHeaderCell, { width: 75 }]}>Type</Text>
                    </>
                  )}
                  <Text style={[styles.tableHeaderCell, { width: 55 }]}>Qty</Text>
                  <Text style={[styles.tableHeaderCell, { width: 85 }]}>Rate</Text>
                  <Text style={[styles.tableHeaderCell, { width: 100 }]}>Amount</Text>
                  <Text style={[styles.tableHeaderCell, { width: 80 }]}>Actions</Text>
                </View>

                {/* Table Data Rows */}
                {rows.map((row, index) => (
                  <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { width: 45 }]}>{row.sNo}</Text>
                    <Text style={[styles.tableCell, styles.tableCellLeft, { width: 160 }]} numberOfLines={1}>
                      {row.description}
                    </Text>
                    {layoutMode === "new" && (
                      <>
                        <Text style={[styles.tableCell, { width: 85 }]}>{row.boardThickness || "-"}</Text>
                        <Text style={[styles.tableCell, { width: 75 }]}>{row.size || "-"}</Text>
                        <Text style={[styles.tableCell, { width: 65 }]}>{row.unit === "" ? "—" : row.unit}</Text>
                        <Text style={[styles.tableCell, { width: 65 }]}>{row.unit === "Sq.ft" ? row.area : "-"}</Text>
                        <Text style={[styles.tableCell, { width: 75 }]}>{row.type || "Standard"}</Text>
                      </>
                    )}
                    <Text style={[styles.tableCell, { width: 55 }]}>{row.quantity}</Text>
                    <Text style={[styles.tableCell, styles.tableCellRight, { width: 85 }]}>
                      ₹{(row.rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellRight, { width: 100, color: Theme.colors.primary }]}>
                      ₹{(row.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                    <View style={[styles.tableActionsCell, { width: 80 }]}>
                      <TouchableOpacity onPress={() => handleEditItem(index)} style={styles.tableActionBtn}>
                        <Ionicons name="create-outline" size={15} color={Theme.colors.secondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteItem(index)} style={styles.tableActionBtn}>
                        <Ionicons name="trash-outline" size={15} color={Theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

        </ScrollView>

        {/* Fixed bottom area containing summary calculations and save action button */}
        <View style={styles.fixedBottomContainer}>
          {/* Totals Summary Panel Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Summary Calculations</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryVal}>{formatCurrency(subtotal)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount (₹):</Text>
              <TextInput
                style={styles.summaryInput}
                keyboardType="numeric"
                value={discount === 0 ? "" : discount.toString()}
                onChangeText={(val) => setDiscount(val === "" ? 0 : parseFloat(val))}
                placeholder="0"
              />
            </View>

            <View style={[styles.summaryRow, styles.totalRowBorder]}>
              <Text style={styles.summaryLabelBold}>Grand Total:</Text>
              <Text style={styles.summaryValBold}>{formatCurrency(total)}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid Amount (₹):</Text>
              <TextInput
                style={styles.summaryInput}
                keyboardType="numeric"
                value={paidAmount === 0 ? "" : paidAmount.toString()}
                onChangeText={(val) => setPaidAmount(val === "" ? 0 : parseFloat(val))}
                placeholder="0"
              />
            </View>

            <View style={[styles.summaryRow, { marginTop: 4 }]}>
              <Text style={styles.summaryLabelBold}>Balance Due:</Text>
              <Text
                style={[
                  styles.summaryValBold,
                  { color: balanceDue > 0 ? Theme.colors.error : Theme.colors.success },
                ]}
              >
                {formatCurrency(balanceDue)}
              </Text>
            </View>
          </View>

          {/* Action Footer Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveInvoice} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#FFF" />
                  <Text style={styles.saveButtonText}>{editingInvoice ? "Save Changes" : "Save Record"}</Text>
                </>
              )}
            </TouchableOpacity>

            {editingInvoice && (
              <View style={styles.shareButtonsRow}>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: Theme.colors.primary }]}
                  onPress={() => exportInvoicePDF(editingInvoice)}
                >
                  <Ionicons name="document-text" size={16} color="#FFF" />
                  <Text style={styles.shareBtnText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: Theme.colors.success }]}
                  onPress={() => exportInvoiceExcel(editingInvoice)}
                >
                  <Ionicons name="grid-outline" size={16} color="#FFF" />
                  <Text style={styles.shareBtnText}>Excel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Modal: Edit Invoice Details Metadata (1:1 with desktop form inputs) */}
        <Modal visible={metadataModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingInvoice ? "Edit Invoice Details" : "Create New Invoice"}</Text>
                <TouchableOpacity onPress={() => setMetadataModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                {/* Format selection */}
                <Text style={styles.fieldLabel}>Invoice / Quotation</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => openOptionPicker("Select Format Type", FORMATS, "format")}
                >
                  <Text style={styles.selectInputText}>{format}</Text>
                  <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                </TouchableOpacity>

                {/* Shop choice */}
                <Text style={styles.fieldLabel}>Shop Office</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => openOptionPicker("Select Shop Office", SHOPS, "shop")}
                >
                  <Text style={styles.selectInputText}>{shop}</Text>
                  <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                </TouchableOpacity>


                {/* Date */}
                <Text style={styles.fieldLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.selectInputText}>{dayjs(date).format("DD MMMM YYYY")}</Text>
                  <Ionicons name="calendar-outline" size={16} color={Theme.colors.textSecondary} />
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={dayjs(date, "YYYY-MM-DD").toDate()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                  />
                )}

                {/* Customer Name */}
                <Text style={styles.fieldLabel}>Customer Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter customer name"
                  value={customerName}
                  onChangeText={setCustomerName}
                />

                {/* Project Name */}
                <Text style={styles.fieldLabel}>Project Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Led boards, elevation"
                  value={projectName}
                  onChangeText={setProjectName}
                />

                <Text style={styles.fieldLabel}>Invoice Type</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Signage Work, Sticker Work"
                  value={invoiceType}
                  onChangeText={setInvoiceType}
                />

                <TouchableOpacity style={styles.modalSaveButton} onPress={() => setMetadataModalVisible(false)}>
                  <Text style={styles.modalSaveButtonText}>{editingInvoice ? "Save Details" : "Create"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Modal: Add/Edit Item Row Form (1:1 with desktop columns and conditions) */}
        <Modal visible={itemModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingItemIndex !== null ? "Edit Item" : "Add Item"}</Text>
                <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                {/* Description */}
                <Text style={styles.fieldLabel}>Description *</Text>
                <TextInput style={styles.input} value={itemDesc} onChangeText={setItemDesc} placeholder="Signboard Fabrication" />

                {layoutMode === "new" && (
                  <>
                    {/* Board thickness */}
                    <Text style={styles.fieldLabel}>Board Thickness</Text>
                    <TouchableOpacity
                      style={styles.selectInput}
                      onPress={() => openOptionPicker("Select Thickness Option", THICKNESS_OPTIONS, "thickness")}
                    >
                      <Text style={styles.selectInputText}>{itemThickness || "(None/Select)"}</Text>
                      <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Size */}
                    <Text style={styles.fieldLabel}>Size</Text>
                    <TextInput
                      style={styles.input}
                      value={itemSize}
                      onChangeText={(val) => {
                        setItemSize(val);
                        const area = parseSizeToArea(val);
                        if (area !== null) {
                          setItemArea(area.toString());
                        }
                      }}
                      placeholder="e.g. 10x4"
                    />

                    {/* Unit */}
                    <Text style={styles.fieldLabel}>Unit</Text>
                    <TouchableOpacity
                      style={styles.selectInput}
                      onPress={() => openOptionPicker("Select Unit Option", UNIT_OPTIONS, "unit")}
                    >
                      <Text style={styles.selectInputText}>{itemUnit === "" ? "(None)" : itemUnit}</Text>
                      <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Custom material type input toggle block */}
                    {showCustomType ? (
                      <View>
                        <Text style={styles.fieldLabel}>Custom Type *</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={customTypeInput}
                            onChangeText={(val) => {
                              setCustomTypeInput(val);
                            }}
                            placeholder="Enter material type"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              setShowCustomType(false);
                              setCustomTypeInput("");
                              setItemType("ACP");
                            }}
                            style={{ padding: 6, backgroundColor: "#F4F5F7", borderRadius: 6 }}
                          >
                            <Ionicons name="close" size={20} color={Theme.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.fieldLabel}>Type</Text>
                        <TouchableOpacity
                          style={styles.selectInput}
                          onPress={() => openOptionPicker("Select Type Option", TYPE_OPTIONS, "type")}
                        >
                          <Text style={styles.selectInputText}>{itemType || "ACP"}</Text>
                          <Ionicons name="chevron-down" size={16} color={Theme.colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Area */}
                    <Text style={styles.fieldLabel}>
                      {itemType === "Other" ? "Area (Sq.ft)" : (itemUnit === "Sq.ft" ? "Area (Sq.ft) *" : "Area (Sq.ft)")}
                    </Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={itemArea} onChangeText={setItemArea} placeholder="40" />
                  </>
                )}

                {/* Quantity */}
                <Text style={styles.fieldLabel}>
                  {layoutMode === "old" ? "Quantity *" : (itemType === "Other" ? "Quantity" : (itemUnit !== "Sq.ft" ? "Quantity *" : "Quantity"))}
                </Text>
                <TextInput style={styles.input} keyboardType="numeric" value={itemQty} onChangeText={setItemQty} />

                {/* Rate */}
                <Text style={styles.fieldLabel}>
                  {layoutMode === "old" ? "Rate (INR) *" : (itemType === "Other" ? "Rate (INR)" : "Rate (INR) *")}
                </Text>
                <TextInput style={styles.input} keyboardType="numeric" value={itemRate} onChangeText={setItemRate} placeholder="120" />

                {/* Amount */}
                <Text style={styles.fieldLabel}>
                  {layoutMode === "new" && itemType === "Other" ? "Amount *" : "Amount"}
                </Text>
                <TextInput
                  style={[styles.input, (layoutMode === "new" && itemType !== "Other") && styles.inputReadonly]}
                  keyboardType="numeric"
                  editable={layoutMode === "old" || itemType === "Other"}
                  value={layoutMode === "new" && itemType !== "Other" ? formatCurrency(computedAmount()) : itemAmount}
                  onChangeText={setItemAmount}
                  placeholder="Auto-calculated"
                />

                <TouchableOpacity
                  style={[styles.modalSaveButton, !isItemFormValid() && { opacity: 0.5 }]}
                  disabled={!isItemFormValid()}
                  onPress={handleSaveItem}
                >
                  <Text style={styles.modalSaveButtonText}>{editingItemIndex !== null ? "Save" : "Add"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Options Selection Dropdown Overlay Picker */}
        <Modal visible={pickerVisible} animationType="fade" transparent>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitleText}>{pickerTitle}</Text>
              <FlatList
                data={pickerOptions}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.pickerItemRow} onPress={() => handleSelectOption(item)}>
                    <Text style={styles.pickerItemText}>{item || "(None)"}</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.pickerCancelBtn} onPress={() => setPickerVisible(false)}>
                <Text style={styles.pickerCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Theme.colors.primary,
  },
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    backgroundColor: Theme.colors.primary,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#DCDCE6",
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  backButton: {
    padding: 6,
  },
  topToolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  layoutTabs: {
    flexDirection: "row",
    backgroundColor: "#F4F5F7",
    borderRadius: 8,
    padding: 3,
    width: "48%",
  },
  layoutTabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  layoutTabBtnActive: {
    backgroundColor: "#FFF",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  layoutTabText: {
    fontSize: 13,
    fontWeight: "bold",
    color: Theme.colors.textSecondary,
  },
  layoutTabTextActive: {
    color: Theme.colors.primary,
  },
  toolbarActionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  btnSolid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Theme.colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnSolidText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFF",
  },
  scrollContent: {
    padding: 12,
  },
  detailsCard: {
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    position: "relative",
  },
  detailsCardTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: Theme.colors.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
  },
  gridItem: {
    width: "50%",
    paddingRight: 6,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: Theme.colors.textSecondary,
    textTransform: "uppercase",
  },
  gridValue: {
    fontSize: 14,
    color: Theme.colors.text,
    marginTop: 2,
  },
  detailsEditBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F4F5F7",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  detailsEditBtnText: {
    fontSize: 12,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  itemsListTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Theme.colors.primary,
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.roundness,
    padding: 24,
    borderStyle: "dashed",
    borderWidth: 1.5,
    borderColor: Theme.colors.border,
    marginBottom: 16,
  },
  emptyText: {
    marginTop: 8,
    color: Theme.colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  tableScrollView: {
    marginBottom: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFF",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1E1E2D",
    paddingVertical: 10,
    alignItems: "center",
  },
  tableHeaderCell: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 12.5,
    paddingHorizontal: 6,
    textAlign: "center",
  },
  tableHeaderCellLeft: {
    textAlign: "left",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F4F5F7",
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#FFF",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFC",
  },
  tableCell: {
    fontSize: 13,
    color: Theme.colors.text,
    paddingHorizontal: 6,
    textAlign: "center",
  },
  tableCellLeft: {
    textAlign: "left",
  },
  tableCellRight: {
    textAlign: "right",
  },
  tableActionsCell: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  tableActionBtn: {
    padding: 4,
  },
  summaryCard: {
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1.5,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: Theme.colors.primary,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  summaryInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 90,
    textAlign: "right",
    fontSize: 14,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  totalRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 6,
    marginTop: 6,
  },
  summaryLabelBold: {
    fontSize: 15,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  summaryValBold: {
    fontSize: 16,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  actionButtonsContainer: {
    marginTop: 6,
    marginBottom: 0,
    gap: 8,
  },
  saveButton: {
    backgroundColor: Theme.colors.secondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: Theme.roundness,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  shareButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: Theme.roundness,
  },
  shareBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  modalScroll: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: Theme.colors.textSecondary,
    marginTop: 10,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: Theme.colors.text,
    backgroundColor: "#FFF",
  },
  inputReadonly: {
    backgroundColor: "#F2F2F7",
    color: Theme.colors.textSecondary,
  },
  selectInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFF",
  },
  selectInputText: {
    fontSize: 15,
    color: Theme.colors.text,
  },
  shopToggleContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  shopToggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 6,
    backgroundColor: "#FFF",
  },
  shopToggleButtonActive: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  shopToggleText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  shopToggleTextActive: {
    color: "#FFF",
  },
  modalSaveButton: {
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  modalSaveButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 30,
  },
  pickerContainer: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    maxHeight: "70%",
  },
  pickerTitleText: {
    fontSize: 17,
    fontWeight: "bold",
    color: Theme.colors.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  pickerItemRow: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Theme.colors.border,
  },
  pickerItemText: {
    fontSize: 15,
    color: Theme.colors.text,
    textAlign: "center",
  },
  pickerCancelBtn: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: "#F4F5F7",
    borderRadius: 8,
    alignItems: "center",
  },
  pickerCancelBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: Theme.colors.textSecondary,
  },
  fixedBottomContainer: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 20 : 10,
  },
});
