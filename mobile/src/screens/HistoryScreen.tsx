import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { Theme } from "../theme";
import { API_URL } from "../config";
import { StoredInvoice } from "../types";
import { exportInvoicePDF, exportInvoiceExcel } from "../utils/exporters";
import { documentDirectory, downloadAsync } from "expo-file-system/src/legacy/FileSystem";
import * as Sharing from "expo-sharing";
import { CustomAlertModal } from "../components/CustomAlertModal";
import { DocumentLoadingModal } from "../components/DocumentLoadingModal";

const SHOPS = ["SZ SIGNAGE", "STICKER ZONE"];
const FORMATS = ["ALL", "INVOICE", "QUOTATION"];
const PAYMENT_STATUSES = ["ALL", "UNPAID", "PARTIALLY PAID", "FULLY PAID"];

export default function HistoryScreen({ navigation, onOpenMenu }: any) {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  
  // Filters (Default selectedShop is "SZ SIGNAGE", matching desktop tabs, no "ALL" shop)
  const [selectedShop, setSelectedShop] = useState("SZ SIGNAGE");
  const [selectedFormat, setSelectedFormat] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  
  // Date Filters (default to today, matching desktop app)
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Summary Metrics
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);

  // Quick Pay Modal
  const [quickPayOpen, setQuickPayOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<StoredInvoice | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState("");

  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: "info" | "success" | "error" | "warning" | "delete";
    onConfirm?: () => void;
    confirmText?: string;
  }>({
    visible: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: "info" | "success" | "error" | "warning" | "delete" = "info",
    onConfirm?: () => void,
    confirmText?: string
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      onConfirm,
      confirmText,
    });
  };

  // Document Generation Loader State
  const [docLoading, setDocLoading] = useState(false);
  const [docMessage, setDocMessage] = useState("");

  // Fetch invoices with all active filters
  const fetchInvoices = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      let query = `?page=1&limit=200`; // Fetch large list for history page

      if (search.trim()) {
        query += `&search=${encodeURIComponent(search)}`;
      }
      query += `&shop=${encodeURIComponent(selectedShop)}`;
      if (selectedFormat !== "ALL") {
        query += `&format=${encodeURIComponent(selectedFormat)}`;
      }
      if (selectedStatus !== "ALL") {
        query += `&paymentStatus=${encodeURIComponent(selectedStatus)}`;
      }
      if (startDate) {
        query += `&startDate=${encodeURIComponent(dayjs(startDate).startOf("day").toISOString())}`;
      }
      if (endDate) {
        query += `&endDate=${encodeURIComponent(dayjs(endDate).endOf("day").toISOString())}`;
      }

      const res = await fetch(`${API_URL}/api/invoices${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.invoices) {
          setInvoices(data.invoices);
          setTotalRevenue(data.totalRevenue || 0);
          setTotalPaid(data.totalPaid || 0);
          setTotalBalance(data.totalBalance || 0);
        } else if (Array.isArray(data)) {
          setInvoices(data);
          const rev = data.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
          const paid = data.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
          setTotalRevenue(rev);
          setTotalPaid(paid);
          setTotalBalance(rev - paid);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refetch when any query parameter changes
  useEffect(() => {
    fetchInvoices(true);
  }, [search, selectedShop, selectedFormat, selectedStatus, startDate, endDate]);



  const handleRefresh = () => {
    setRefreshing(true);
    fetchInvoices(false);
  };

  // Reset all filters to default
  const handleClearFilters = () => {
    setSearch("");
    setSelectedShop("SZ SIGNAGE");
    setSelectedFormat("ALL");
    setSelectedStatus("ALL");
    setStartDate(null);
    setEndDate(null);
  };

  // Handle Quick Pay Update
  const openQuickPay = (invoice: StoredInvoice) => {
    setSelectedInvoice(invoice);
    setQuickPayAmount(String(invoice.paidAmount || 0));
    setQuickPayOpen(true);
  };

  const handleSaveQuickPay = async () => {
    if (!selectedInvoice) return;
    const paidVal = parseFloat(quickPayAmount || "0");
    if (isNaN(paidVal) || paidVal < 0) {
      showAlert("Invalid Input", "Please enter a valid non-negative number.", "warning");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/invoices/${selectedInvoice._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...selectedInvoice,
          paidAmount: paidVal,
        }),
      });

      if (res.ok) {
        setQuickPayOpen(false);
        setSelectedInvoice(null);
        fetchInvoices(false);
      } else {
        showAlert("Error", "Failed to update payment details on the server.", "error");
      }
    } catch (err) {
      showAlert("Error", "Server communication failed.", "error");
    }
  };

  // Delete invoice
  const handleDeleteInvoice = (id: string) => {
    showAlert(
      "Are you sure?",
      "Do you really want to delete this billing record? This action will permanently remove it from the database.",
      "delete",
      async () => {
        try {
          const res = await fetch(`${API_URL}/api/invoices/${id}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setInvoices(invoices.filter((inv) => inv._id !== id));
            fetchInvoices(false);
          } else {
            showAlert("Error", "Failed to delete the record from the database.", "error");
          }
        } catch (err) {
          showAlert("Error", "Server connection failed.", "error");
        }
      },
      "Delete"
    );
  };

  // Bulk Export Excel
  const handleExportExcelBulk = async () => {
    try {
      let query = `?shop=${encodeURIComponent(selectedShop)}`;
      if (selectedFormat !== "ALL") {
        query += `&format=${selectedFormat}`;
      }
      if (selectedStatus !== "ALL") {
        query += `&status=${selectedStatus}`;
      }
      if (startDate) {
        query += `&startDate=${dayjs(startDate).startOf("day").toISOString()}`;
      }
      if (endDate) {
        query += `&endDate=${dayjs(endDate).endOf("day").toISOString()}`;
      }
      if (search.trim()) {
        query += `&search=${encodeURIComponent(search)}`;
      }

      const url = `${API_URL}/api/invoices/export/excel${query}`;
      const filename = `${selectedShop.replace(/\s+/g, "_")}_Export_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      const targetUri = `${documentDirectory}${filename}`;

      setDocMessage("Generating bulk Excel report, please wait for some time...");
      setDocLoading(true);
      const downloadRes = await downloadAsync(url, targetUri);
      setDocLoading(false);
      
      if (downloadRes.status !== 200) {
        showAlert("Error", "Failed to export Excel report from the server.", "error");
        return;
      }

      // Open Native Sharing
      await Sharing.shareAsync(targetUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Download Excel Report",
        UTI: "com.microsoft.excel.xlsx",
      });
    } catch (err) {
      console.error("Bulk export failed:", err);
      showAlert("Error", "Export action failed.", "error");
    } finally {
      setDocLoading(false);
    }
  };

  // Date picker handlers
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top"]}>
      <View style={styles.container}>
        {/* Top Header Section (1:1 Text matching desktop) */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={onOpenMenu} style={{ padding: 4 }}>
              <Ionicons name="menu" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Invoicing & History Records</Text>
              <Text style={styles.headerSubtitle}>
                Track database history, filter transactions, and monitor shop revenue streams
              </Text>
            </View>
          </View>
        </View>

        {/* Top Shop Selection Tab Bar (1:1 with desktop activeTab tabs, no "ALL" option) */}
        <View style={styles.shopTabsContainer}>
          {SHOPS.map((shop) => (
            <TouchableOpacity
              key={shop}
              style={[styles.shopTabBtn, selectedShop === shop && styles.shopTabBtnActive]}
              onPress={() => setSelectedShop(shop)}
            >
              <Text style={[styles.shopTabBtnText, selectedShop === shop && styles.shopTabBtnTextActive]}>
                {shop}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1. Summary Statistics Bar (Horizontal single row layout) */}
        <View style={styles.analyticsBar}>
          {/* Card 1: Total Revenue */}
          <View style={[styles.analyticsCard, { backgroundColor: "#E8F7F0", flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }]}>
            <View style={[styles.analyticsIconContainer, { backgroundColor: "#22B378" }]}>
              <Ionicons name="trending-up" size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.analyticsLabel, { color: "#636366" }]} numberOfLines={1}>REVENUE</Text>
                <Ionicons name="trending-up" size={12} color="#22B378" />
              </View>
              <Text style={[styles.analyticsValue, { color: "#1C1C1E" }]} numberOfLines={1}>
                ₹{totalRevenue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </Text>
              <Text style={{ fontSize: 9, color: "#636366" }}>Total revenue</Text>
            </View>
          </View>

          {/* Card 2: Total Collected */}
          <View style={[styles.analyticsCard, { backgroundColor: "#E8F7F0", flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }]}>
            <View style={[styles.analyticsIconContainer, { backgroundColor: "#22B378" }]}>
              <Ionicons name="wallet-outline" size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.analyticsLabel, { color: "#636366" }]} numberOfLines={1}>COLLECTED</Text>
                <Ionicons name="trending-up" size={12} color="#22B378" />
              </View>
              <Text style={[styles.analyticsValue, { color: "#1C1C1E" }]} numberOfLines={1}>
                ₹{totalPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </Text>
              <Text style={{ fontSize: 9, color: "#636366" }}>Total collected</Text>
            </View>
          </View>

          {/* Card 3: Outstanding Dues */}
          <View style={[styles.analyticsCard, { backgroundColor: "#FDECEE", flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }]}>
            <View style={[styles.analyticsIconContainer, { backgroundColor: "#D32F2F" }]}>
              <Ionicons name="receipt-outline" size={16} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.analyticsLabel, { color: "#636366" }]} numberOfLines={1}>DUES</Text>
                <Ionicons name="trending-up" size={12} color="#D32F2F" />
              </View>
              <Text style={[styles.analyticsValue, { color: "#1C1C1E" }]} numberOfLines={1}>
                ₹{totalBalance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </Text>
              <Text style={{ fontSize: 9, color: "#636366" }}>Total dues</Text>
            </View>
          </View>
        </View>

        {/* Scrollable Filters Block */}
        <View style={styles.filtersCard}>
          {/* Filters Bar Toolbar Header */}
          <View style={styles.filterToolbarHeader}>
            <Ionicons name="search-outline" size={16} color="#22B378" />
            <Text style={styles.filterToolbarHeaderLabel}>SEARCH & FILTERS</Text>
          </View>

          {/* Search Input Bar */}
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={16} color={Theme.colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Client, Doc Number or Project Name..."
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {(search || selectedFormat !== "ALL" || selectedStatus !== "ALL" || startDate || endDate) ? (
              <TouchableOpacity onPress={handleClearFilters} style={styles.clearFiltersBtn}>
                <Ionicons name="close-circle" size={18} color={Theme.colors.error} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Document Type Filtering Row (Doc Type) */}
          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>Doc Type:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gap8}>
              {FORMATS.map((fmt) => {
                const label = fmt === "ALL" ? "All Documents" : fmt === "INVOICE" ? "Invoices" : "Quotations";
                return (
                  <TouchableOpacity
                    key={fmt}
                    style={[styles.filterTab, selectedFormat === fmt && styles.filterTabActive]}
                    onPress={() => setSelectedFormat(fmt)}
                  >
                    <Text style={[styles.filterTabText, selectedFormat === fmt && styles.filterTabTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Payment Status Filtering Row */}
          <View style={styles.filterRow}>
            <Text style={styles.filterRowLabel}>Status:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gap8}>
              {PAYMENT_STATUSES.map((status) => {
                const label = status === "ALL" ? "All Payments" : status.charAt(0) + status.slice(1).toLowerCase();
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterTab, selectedStatus === status && styles.filterTabActive]}
                    onPress={() => setSelectedStatus(status)}
                  >
                    <Text style={[styles.filterTabText, selectedStatus === status && styles.filterTabTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Date Picker Row */}
          <View style={styles.datePickerRow}>
            <Text style={styles.datePickerLabel}>Date Range:</Text>
            <View style={styles.dateButtonsContainer}>
              <TouchableOpacity style={styles.dateSelectBtn} onPress={() => setShowStartPicker(true)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="calendar-outline" size={14} color="#636366" />
                  <Text style={styles.dateSelectBtnText}>
                    {startDate ? dayjs(startDate).format("DD MMM YYYY") : "From Date"}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color="#636366" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.dateSeparator, { textTransform: "uppercase", fontSize: 11, fontWeight: "bold", color: "#8E8E93" }]}>TO</Text>
              <TouchableOpacity style={styles.dateSelectBtn} onPress={() => setShowEndPicker(true)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="calendar-outline" size={14} color="#636366" />
                  <Text style={styles.dateSelectBtnText}>
                    {endDate ? dayjs(endDate).format("DD MMM YYYY") : "To Date"}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color="#636366" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Date Picker Modals */}
        {showStartPicker && (
          <DateTimePicker
            value={startDate || new Date()}
            mode="date"
            display="default"
            onChange={handleStartDateChange}
          />
        )}
        {showEndPicker && (
          <DateTimePicker
            value={endDate || new Date()}
            mode="date"
            display="default"
            onChange={handleEndDateChange}
          />
        )}

        {/* Invoice List (Spreadsheet Horizontal Table style matching desktop 1:1) */}
        {loading && invoices.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.secondary} />
            <Text style={styles.loadingText}>Fetching saved billing history...</Text>
          </View>
        ) : invoices.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            <Ionicons name="search-outline" size={50} color="#8E8E93" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#1C1C1E", marginBottom: 6 }}>No records found</Text>
            <Text style={[styles.emptyText, { textAlign: "center", color: "#636366", paddingHorizontal: 30, marginBottom: 20 }]}>
              We couldn't find any records matching your active filter criteria.
            </Text>
            <TouchableOpacity style={styles.clearFiltersBtnEmpty} onPress={handleClearFilters}>
              <Ionicons name="search" size={14} color="#FFF" />
              <Text style={styles.clearFiltersBtnEmptyText}>Clear Filters</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <View style={styles.tableWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
              <View style={styles.table}>
                {/* FlatList with headers inside the list so they scroll together */}
                <FlatList
                  data={invoices}
                  keyExtractor={(item) => item._id}
                  ListHeaderComponent={
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, { width: 45 }]}>S.No</Text>
                      <Text style={[styles.tableHeaderCell, { width: 95 }]}>Date</Text>
                      <Text style={[styles.tableHeaderCell, { width: 110 }]}>Document No</Text>
                      <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLeft, { width: 150 }]}>Customer Name</Text>
                      <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLeft, { width: 135 }]}>Project Name</Text>
                      <Text style={[styles.tableHeaderCell, { width: 80 }]}>Type</Text>
                      <Text style={[styles.tableHeaderCell, { width: 105 }]}>Total Amount</Text>
                      <Text style={[styles.tableHeaderCell, { width: 95 }]}>Paid</Text>
                      <Text style={[styles.tableHeaderCell, { width: 95 }]}>Balance</Text>
                      <Text style={[styles.tableHeaderCell, { width: 95 }]}>Status</Text>
                      <Text style={[styles.tableHeaderCell, { width: 155 }]}>Actions</Text>
                    </View>
                  }
                  renderItem={({ item, index }) => {
                    const balance = (item.totalAmount || 0) - (item.paidAmount || 0);
                    return (
                      <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}>
                        <Text style={[styles.tableCell, { width: 45 }]}>{index + 1}</Text>
                        <Text style={[styles.tableCell, { width: 95 }]}>
                          {dayjs(item.date).format("DD MMM YYYY")}
                        </Text>
                        <Text style={[styles.tableCell, { width: 110, fontWeight: "bold", color: Theme.colors.primary }]}>
                          {item.invoiceNumber}
                        </Text>
                        <Text style={[styles.tableCell, styles.tableCellLeft, { width: 150 }]} numberOfLines={1}>
                          {item.customerName}
                        </Text>
                        <Text style={[styles.tableCell, styles.tableCellLeft, { width: 135 }]} numberOfLines={1}>
                          {item.projectName || "-"}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            {
                              width: 80,
                              fontWeight: "bold",
                              color: item.format === "INVOICE" ? Theme.colors.secondary : Theme.colors.warning,
                            },
                          ]}
                        >
                          {item.format}
                        </Text>
                        <Text style={[styles.tableCell, styles.tableCellRight, { width: 105 }]}>
                          ₹{(item.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </Text>
                        <Text style={[styles.tableCell, styles.tableCellRight, { width: 95, color: Theme.colors.success }]}>
                          ₹{(item.paidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            styles.tableCellRight,
                            {
                              width: 95,
                              color: balance > 0 ? Theme.colors.error : Theme.colors.success,
                              fontWeight: "bold",
                            },
                          ]}
                        >
                          ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            {
                              width: 95,
                              fontWeight: "bold",
                              color: balance === 0 ? Theme.colors.success : (item.paidAmount > 0 ? "#ef6c00" : Theme.colors.error),
                            },
                          ]}
                        >
                          {balance === 0 ? "FULLY PAID" : (item.paidAmount > 0 ? "PARTIALLY PAID" : "UNPAID")}
                        </Text>
                        <View style={[styles.tableActionsCell, { width: 155 }]}>
                          <TouchableOpacity
                            style={styles.tableActionBtn}
                            onPress={() => navigation.navigate("Create", { invoice: item })}
                          >
                            <Ionicons name="create-outline" size={14} color={Theme.colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.tableActionBtn} onPress={() => openQuickPay(item)}>
                            <Ionicons name="cash-outline" size={14} color="#D27D2D" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.tableActionBtn}
                            onPress={() =>
                              exportInvoicePDF(
                                item,
                                () => {
                                  setDocMessage("Compiling PDF document, please wait for some time...");
                                  setDocLoading(true);
                                },
                                () => setDocLoading(false),
                                (msg) => showAlert("Export Error", msg, "error")
                              )
                            }
                          >
                            <Ionicons name="document-text-outline" size={14} color={Theme.colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.tableActionBtn}
                            onPress={() =>
                              exportInvoiceExcel(
                                item,
                                () => {
                                  setDocMessage("Generating Excel spreadsheet, please wait for some time...");
                                  setDocLoading(true);
                                },
                                () => setDocLoading(false),
                                (msg) => showAlert("Export Error", msg, "error")
                              )
                            }
                          >
                            <Ionicons name="grid-outline" size={14} color={Theme.colors.success} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.tableActionBtn} onPress={() => handleDeleteInvoice(item._id)}>
                            <Ionicons name="trash-outline" size={14} color={Theme.colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                />
              </View>
            </ScrollView>
          </View>
        )}

        {/* Quick Pay Modal Overlay */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={quickPayOpen}
          onRequestClose={() => setQuickPayOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Payment Details</Text>
              {selectedInvoice && (
                <>
                  <Text style={styles.modalSubtitle}>
                    {selectedInvoice.invoiceNumber} - {selectedInvoice.customerName}
                  </Text>
                  
                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMetaLabel}>Total Invoice Value:</Text>
                    <Text style={styles.modalMetaValue}>
                      ₹{(selectedInvoice.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMetaLabel}>Current Paid Amount:</Text>
                    <Text style={[styles.modalMetaValue, { color: Theme.colors.success }]}>
                      ₹{(selectedInvoice.paidAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <View style={styles.modalMetaRow}>
                    <Text style={styles.modalMetaLabel}>Remaining Outstanding Balance:</Text>
                    <Text style={[styles.modalMetaValue, { color: Theme.colors.error, fontWeight: "bold" }]}>
                      ₹{((selectedInvoice.totalAmount || 0) - (selectedInvoice.paidAmount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>Paid Amount (INR):</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    placeholder="Enter paid amount"
                    value={quickPayAmount}
                    onChangeText={setQuickPayAmount}
                  />

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnCancel]}
                      onPress={() => setQuickPayOpen(false)}
                    >
                      <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnSave]}
                      onPress={handleSaveQuickPay}
                    >
                      <Text style={styles.modalBtnTextSave}>Save Payment</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <CustomAlertModal
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          confirmText={alertConfig.confirmText}
          onClose={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
          onConfirm={alertConfig.onConfirm}
        />

        <DocumentLoadingModal visible={docLoading} message={docMessage} />

      </View>
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
  shopTabsContainer: {
    flexDirection: "row",
    backgroundColor: "#1E1E2D",
    borderBottomWidth: 1,
    borderBottomColor: "#2B2B3D",
  },
  shopTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  shopTabBtnActive: {
    borderBottomColor: Theme.colors.secondary,
  },
  shopTabBtnText: {
    color: "#A0A0B0",
    fontSize: 14,
    fontWeight: "bold",
  },
  shopTabBtnTextActive: {
    color: "#FFF",
  },
  analyticsBar: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
  },
  analyticsCard: {
    borderRadius: 8,
    padding: 8,
  },
  analyticsIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  analyticsLabel: {
    color: "#636366",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 0.3,
  },
  analyticsValue: {
    fontSize: 13.5,
    fontWeight: "bold",
    marginTop: 1,
  },
  analyticsCaption: {
    fontSize: 10,
    color: "#FFF",
    opacity: 0.7,
    marginTop: 4,
  },
  filtersCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 12,
  },
  filterToolbarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  filterToolbarHeaderLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1C1C1E",
  },
  exportExcelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Theme.colors.success,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exportExcelBtnText: {
    fontSize: 12.5,
    fontWeight: "bold",
    color: Theme.colors.success,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F5F7",
    marginBottom: 16,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    color: Theme.colors.text,
  },
  clearFiltersBtn: {
    padding: 2,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  filterRowLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1C1C1E",
    width: 85,
  },
  gap8: {
    gap: 6,
  },
  filterTab: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  filterTabActive: {
    backgroundColor: "#22B378",
    borderColor: "#22B378",
  },
  filterTabText: {
    fontSize: 12,
    color: "#8E8E93",
  },
  filterTabTextActive: {
    color: "#FFF",
    fontWeight: "bold",
  },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  datePickerLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1C1C1E",
    width: 85,
  },
  dateButtonsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateSelectBtn: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  dateSelectBtnText: {
    fontSize: 12,
    color: "#1C1C1E",
    fontWeight: "bold",
  },
  dateSeparator: {
    marginHorizontal: 4,
  },
  clearFiltersBtnEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22B378",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  clearFiltersBtnEmptyText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    marginTop: 10,
    color: Theme.colors.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  tableWrapper: {
    flex: 1,
    backgroundColor: "#FFF",
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    overflow: "hidden",
  },
  tableScrollView: {
    flex: 1,
  },
  table: {
    flex: 1,
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
    paddingVertical: 10,
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
    gap: 8,
  },
  tableActionBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: Theme.colors.text,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  modalMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F4F5F7",
  },
  modalMetaLabel: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  modalMetaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.colors.text,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: Theme.colors.text,
    marginTop: 16,
    marginBottom: 6,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: Theme.colors.text,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalBtn: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: "#F4F5F7",
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalBtnSave: {
    backgroundColor: Theme.colors.secondary,
  },
  modalBtnTextCancel: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
    fontWeight: "600",
  },
  modalBtnTextSave: {
    fontSize: 14,
    color: "#FFF",
    fontWeight: "600",
  },
});
