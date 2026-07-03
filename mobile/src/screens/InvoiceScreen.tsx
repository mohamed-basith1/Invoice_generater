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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Theme } from "../theme";
import { API_URL } from "../config";
import { InvoiceData, InvoiceItem } from "../types";
import { exportInvoicePDF, exportInvoiceExcel } from "../utils/exporters";

const formatCurrency = (val: number) => {
  return "₹" + val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SHOPS = ["SZ SIGNAGE", "STICKER ZONE"];
const INVOICE_TYPES = ["Signage Work", "Sticker Work", "Printing Work"];
const UNITS = ["Qty", "Sq.ft"];

export default function InvoiceScreen({ navigation, route }: any) {
  const editingInvoice = route?.params?.invoice;

  // Form State
  const [format, setFormat] = useState<"INVOICE" | "QUOTATION">("INVOICE");
  const [shop, setShop] = useState("SZ SIGNAGE");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [invoiceType, setInvoiceType] = useState("Signage Work");
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [rows, setRows] = useState<InvoiceItem[]>([]);

  // Modals & UI States
  const [loading, setLoading] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // New Item State
  const [itemDesc, setItemDesc] = useState("");
  const [itemThickness, setItemThickness] = useState("");
  const [itemSize, setItemSize] = useState("");
  const [itemUnit, setItemUnit] = useState("Qty");
  const [itemArea, setItemArea] = useState("");
  const [itemType, setItemType] = useState("Standard"); // Standard vs Other
  const [itemQty, setItemQty] = useState("");
  const [itemRate, setItemRate] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  // Load next invoice number
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
    } else {
      fetchNextInvoiceNumber(shop, format);
    }
  }, [editingInvoice]);

  useEffect(() => {
    if (!editingInvoice) {
      fetchNextInvoiceNumber(shop, format);
    }
  }, [shop, format]);

  // Handle auto-calculating item amount as you type details
  useEffect(() => {
    const qty = itemQty === "" ? 0 : parseFloat(itemQty);
    const area = itemArea === "" ? 0 : parseFloat(itemArea);
    const rate = itemRate === "" ? 0 : parseFloat(itemRate);

    if (itemType === "Other") {
      // Manual input for amount is allowed, don't overwrite if already typed
    } else {
      let computed = 0;
      if (itemUnit === "Sq.ft") {
        const factorQty = qty === 0 ? 1 : qty;
        computed = factorQty * area * rate;
      } else {
        computed = qty * rate;
      }
      setItemAmount(computed > 0 ? computed.toString() : "");
    }
  }, [itemQty, itemArea, itemRate, itemUnit, itemType]);

  // Calculations
  const subtotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const total = Math.max(0, subtotal - discount);
  const balanceDue = Math.max(0, total - paidAmount);

  // Add or edit row
  const handleSaveItem = () => {
    if (!itemDesc.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }

    const qty = itemQty === "" ? 0 : parseFloat(itemQty);
    const area = itemArea === "" ? 0 : parseFloat(itemArea);
    const rate = itemRate === "" ? 0 : parseFloat(itemRate);
    const amount = itemAmount === "" ? 0 : parseFloat(itemAmount);

    const newItem: InvoiceItem = {
      sNo: editingItemIndex !== null ? rows[editingItemIndex].sNo : rows.length + 1,
      description: itemDesc,
      boardThickness: itemThickness || undefined,
      size: itemSize || undefined,
      unit: itemUnit,
      area: area,
      type: itemType,
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
    setItemUnit("Qty");
    setItemArea("");
    setItemType("Standard");
    setItemQty("");
    setItemRate("");
    setItemAmount("");
  };

  const handleEditItem = (index: number) => {
    const item = rows[index];
    setEditingItemIndex(index);
    setItemDesc(item.description);
    setItemThickness(item.boardThickness || "");
    setItemSize(item.size || "");
    setItemUnit(item.unit);
    setItemArea(item.area ? item.area.toString() : "");
    setItemType(item.type || "Standard");
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
      Alert.alert("Error", "Please enter a customer name");
      return;
    }
    if (rows.length === 0) {
      Alert.alert("Error", "Please add at least one item row");
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
        Alert.alert("Success", editingInvoice ? "Invoice updated!" : "Invoice saved!");
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
        Alert.alert("Error", errorMsg || "Failed to save invoice");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to connect to the backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{editingInvoice ? "Edit Invoice" : "Create Invoice"}</Text>
          {editingInvoice && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Format Selection Tab Segment */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, format === "INVOICE" && styles.tabButtonActive]}
              onPress={() => setFormat("INVOICE")}
            >
              <Text style={[styles.tabText, format === "INVOICE" && styles.tabTextActive]}>INVOICE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, format === "QUOTATION" && styles.tabButtonActive]}
              onPress={() => setFormat("QUOTATION")}
            >
              <Text style={[styles.tabText, format === "QUOTATION" && styles.tabTextActive]}>QUOTATION</Text>
            </TouchableOpacity>
          </View>

          {/* Form Controls Card */}
          <View style={styles.card}>
            {/* Shop Choice */}
            <Text style={styles.fieldLabel}>Shop Office</Text>
            <View style={styles.shopToggleContainer}>
              {SHOPS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.shopToggleButton, shop === s && styles.shopToggleButtonActive]}
                  onPress={() => setShop(s)}
                >
                  <Text style={[styles.shopToggleText, shop === s && styles.shopToggleTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Invoice Number & Date Row */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Doc Number</Text>
                <TextInput style={styles.input} value={invoiceNumber} onChangeText={setInvoiceNumber} />
              </View>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} value={date} onChangeText={setDate} />
              </View>
            </View>

            {/* Customer Details */}
            <Text style={styles.fieldLabel}>Customer Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Sticker Zone Client" value={customerName} onChangeText={setCustomerName} />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Project Name</Text>
                <TextInput style={styles.input} placeholder="e.g. LED Signboard" value={projectName} onChangeText={setProjectName} />
              </View>
              <View style={styles.col}>
                <Text style={styles.fieldLabel}>Invoice Type</Text>
                <View style={styles.dropdownFake}>
                  <TextInput
                    style={styles.dropdownFakeText}
                    value={invoiceType}
                    onChangeText={setInvoiceType}
                    placeholder="Signage Work"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Items Section Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Invoice Items ({rows.length})</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => { resetItemForm(); setItemModalVisible(true); }}>
              <Ionicons name="add-circle" size={18} color="#FFF" />
              <Text style={styles.addButtonText}>Add Row</Text>
            </TouchableOpacity>
          </View>

          {/* Item List Rows */}
          {rows.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={40} color={Theme.colors.textSecondary} />
              <Text style={styles.emptyText}>No items added yet. Tap Add Row below.</Text>
            </View>
          ) : (
            rows.map((row, index) => (
              <View key={index} style={styles.itemRowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemRowDesc}>{row.sNo}. {row.description}</Text>
                  <Text style={styles.itemRowDetails}>
                    {row.unit === "Sq.ft" ? `${row.quantity} x ${row.area} sqft` : `${row.quantity} unit(s)`} @ {formatCurrency(row.rate)}
                  </Text>
                  {row.boardThickness && <Text style={styles.itemRowSubDetails}>Thick: {row.boardThickness} | Size: {row.size}</Text>}
                </View>
                <View style={styles.itemRowAmountCol}>
                  <Text style={styles.itemRowAmount}>{formatCurrency(row.amount)}</Text>
                  <View style={styles.itemActionButtons}>
                    <TouchableOpacity onPress={() => handleEditItem(index)} style={styles.rowIconBtn}>
                      <Ionicons name="create-outline" size={16} color={Theme.colors.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteItem(index)} style={styles.rowIconBtn}>
                      <Ionicons name="trash-outline" size={16} color={Theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Totals Summary Panel Card */}
          <View style={[styles.card, { marginTop: 24 }]}>
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
                  <Ionicons name="cloud-upload" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>{editingInvoice ? "Save Changes" : "Save Record"}</Text>
                </>
              )}
            </TouchableOpacity>

            {editingInvoice && (
              <View style={styles.shareButtonsRow}>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: Theme.colors.secondary }]}
                  onPress={() => exportInvoicePDF(editingInvoice)}
                >
                  <Ionicons name="document-text" size={18} color="#FFF" />
                  <Text style={styles.shareBtnText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: Theme.colors.success }]}
                  onPress={() => exportInvoiceExcel(editingInvoice)}
                >
                  <Ionicons name="grid-outline" size={18} color="#FFF" />
                  <Text style={styles.shareBtnText}>Excel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modal: Add/Edit Item Row Form */}
        <Modal visible={itemModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingItemIndex !== null ? "Edit Row" : "Add Row"}</Text>
                <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Theme.colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput style={styles.input} value={itemDesc} onChangeText={setItemDesc} placeholder="Signboard Fabrication" />

                {/* Standard / Other Toggle */}
                <Text style={styles.fieldLabel}>Row Type Mode</Text>
                <View style={styles.shopToggleContainer}>
                  <TouchableOpacity
                    style={[styles.shopToggleButton, itemType === "Standard" && styles.shopToggleButtonActive]}
                    onPress={() => setItemType("Standard")}
                  >
                    <Text style={[styles.shopToggleText, itemType === "Standard" && styles.shopToggleTextActive]}>Standard Auto-calc</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.shopToggleButton, itemType === "Other" && styles.shopToggleButtonActive]}
                    onPress={() => setItemType("Other")}
                  >
                    <Text style={[styles.shopToggleText, itemType === "Other" && styles.shopToggleTextActive]}>Other Manual Amount</Text>
                  </TouchableOpacity>
                </View>

                {itemType === "Standard" ? (
                  <>
                    <View style={styles.row}>
                      <View style={styles.col}>
                        <Text style={styles.fieldLabel}>Thickness</Text>
                        <TextInput style={styles.input} value={itemThickness} onChangeText={setItemThickness} placeholder="3mm" />
                      </View>
                      <View style={styles.col}>
                        <Text style={styles.fieldLabel}>Size</Text>
                        <TextInput style={styles.input} value={itemSize} onChangeText={setItemSize} placeholder="4 x 2 ft" />
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={styles.col}>
                        <Text style={styles.fieldLabel}>Unit</Text>
                        <View style={styles.shopToggleContainer}>
                          {UNITS.map((u) => (
                            <TouchableOpacity
                              key={u}
                              style={[styles.shopToggleButton, itemUnit === u && styles.shopToggleButtonActive]}
                              onPress={() => setItemUnit(u)}
                            >
                              <Text style={[styles.shopToggleText, itemUnit === u && styles.shopToggleTextActive]}>{u}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      {itemUnit === "Sq.ft" && (
                        <View style={styles.col}>
                          <Text style={styles.fieldLabel}>Area (Sqft)</Text>
                          <TextInput style={styles.input} keyboardType="numeric" value={itemArea} onChangeText={setItemArea} placeholder="8.00" />
                        </View>
                      )}
                    </View>

                    <View style={styles.row}>
                      <View style={styles.col}>
                        <Text style={styles.fieldLabel}>Quantity</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={itemQty} onChangeText={setItemQty} placeholder="1" />
                      </View>
                      <View style={styles.col}>
                        <Text style={styles.fieldLabel}>Rate (₹)</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={itemRate} onChangeText={setItemRate} placeholder="120" />
                      </View>
                    </View>
                  </>
                ) : null}

                <Text style={styles.fieldLabel}>Row Amount (₹)</Text>
                <TextInput
                  style={[styles.input, itemType === "Standard" && styles.disabledInput]}
                  keyboardType="numeric"
                  editable={itemType === "Other"}
                  value={itemAmount}
                  onChangeText={setItemAmount}
                  placeholder="0.00"
                />

                <TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveItem}>
                  <Text style={styles.modalSaveButtonText}>Apply Changes</Text>
                </TouchableOpacity>
              </ScrollView>
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
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  backButton: {
    position: "absolute",
    left: 20,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: Theme.colors.border,
    borderRadius: Theme.roundness,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: Theme.roundness - 2,
  },
  tabButtonActive: {
    backgroundColor: "#FFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
  },
  tabText: {
    fontWeight: "600",
    color: Theme.colors.textSecondary,
    fontSize: 13,
  },
  tabTextActive: {
    color: Theme.colors.primary,
  },
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.roundness,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    marginTop: 10,
  },
  input: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  disabledInput: {
    backgroundColor: "#E5E5EA",
    color: "#8E8E93",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  dropdownFake: {
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownFakeText: {
    fontSize: 14,
    color: Theme.colors.text,
    padding: 0,
  },
  shopToggleContainer: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  shopToggleButton: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  shopToggleButtonActive: {
    backgroundColor: Theme.colors.secondary,
    borderColor: Theme.colors.secondary,
  },
  shopToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  shopToggleTextActive: {
    color: "#FFF",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  addButton: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 12,
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
  },
  emptyText: {
    marginTop: 8,
    color: Theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  itemRowCard: {
    backgroundColor: Theme.colors.card,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.secondary,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  itemRowDesc: {
    fontSize: 14,
    fontWeight: "bold",
    color: Theme.colors.text,
  },
  itemRowDetails: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  itemRowSubDetails: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 2,
  },
  itemRowAmountCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  itemRowAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.colors.primary,
  },
  itemActionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  rowIconBtn: {
    padding: 4,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: Theme.colors.primary,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  summaryInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: 100,
    textAlign: "right",
    fontSize: 13,
    color: Theme.colors.text,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  totalRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    paddingTop: 8,
    marginTop: 8,
  },
  summaryLabelBold: {
    fontSize: 14,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  summaryValBold: {
    fontSize: 15,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  actionButtonsContainer: {
    marginVertical: 20,
    gap: 12,
  },
  saveButton: {
    backgroundColor: Theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: Theme.roundness,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 15,
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
    fontSize: 13,
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
    fontSize: 16,
    fontWeight: "bold",
    color: Theme.colors.primary,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSaveButton: {
    backgroundColor: Theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  modalSaveButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
