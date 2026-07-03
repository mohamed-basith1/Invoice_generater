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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import dayjs from "dayjs";
import { Theme } from "../theme";
import { API_URL } from "../config";
import { StoredInvoice } from "../types";
import { exportInvoicePDF, exportInvoiceExcel } from "../utils/exporters";

const SHOPS = ["ALL", "SZ SIGNAGE", "STICKER ZONE"];

export default function HistoryScreen({ navigation }: any) {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedShop, setSelectedShop] = useState("ALL");

  // Fetch invoices from API
  const fetchInvoices = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      let url = `${API_URL}/api/invoices?search=${encodeURIComponent(search)}`;
      if (selectedShop !== "ALL") {
        url += `&shop=${encodeURIComponent(selectedShop)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Since backend pagination returns { invoices, totalPages, currentPage }, let's parse it
        if (data.invoices) {
          setInvoices(data.invoices);
        } else if (Array.isArray(data)) {
          setInvoices(data);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refetch when search query or selected shop tab switches
  useEffect(() => {
    fetchInvoices();
  }, [search, selectedShop]);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchInvoices(false);
    }, [search, selectedShop])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInvoices(false);
  };

  // Delete invoice
  const handleDeleteInvoice = (id: string) => {
    Alert.alert("Delete Invoice", "Are you sure you want to permanently delete this billing record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/api/invoices/${id}`, {
              method: "DELETE",
            });
            if (res.ok) {
              setInvoices(invoices.filter((inv) => inv._id !== id));
            } else {
              Alert.alert("Error", "Failed to delete from database");
            }
          } catch (err) {
            Alert.alert("Error", "Server connection failed");
          }
        },
      },
    ]);
  };

  // Render Single Invoice Card Item
  const renderItem = ({ item }: { item: StoredInvoice }) => {
    const isQuotation = item.format === "QUOTATION";
    const balance = (item.totalAmount || 0) - (item.paidAmount || 0);

    return (
      <View style={styles.invoiceCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.shopLabel}>{item.shop}</Text>
            <Text style={styles.dateLabel}>{dayjs(item.date).format("DD MMM YYYY")}</Text>
          </View>
          <View
            style={[
              styles.formatTag,
              { backgroundColor: isQuotation ? Theme.colors.warning : Theme.colors.primary },
            ]}
          >
            <Text style={styles.formatTagText}>{item.format}</Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          <View style={styles.rowAlign}>
            <Ionicons name="person-outline" size={15} color={Theme.colors.textSecondary} />
            <Text style={styles.customerName} numberOfLines={1}>
              {item.customerName}
            </Text>
          </View>
          <Text style={styles.invoiceNumberText}>{item.invoiceNumber}</Text>

          {item.projectName ? (
            <View style={styles.rowAlign}>
              <Ionicons name="folder-open-outline" size={14} color={Theme.colors.textSecondary} />
              <Text style={styles.projectText} numberOfLines={1}>
                {item.projectName}
              </Text>
            </View>
          ) : null}

          {/* Amount and Balance block */}
          <View style={styles.amountBlockRow}>
            <View>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.amountValue}>
                ₹{(item.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amountLabel}>Balance Outstanding</Text>
              <Text
                style={[
                  styles.amountValue,
                  { color: balance > 0 ? Theme.colors.error : Theme.colors.success },
                ]}
              >
                ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </View>

        {/* Card Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate("Create", { invoice: item })}
          >
            <Ionicons name="create-outline" size={16} color={Theme.colors.primary} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => exportInvoicePDF(item)}>
            <Ionicons name="document-text-outline" size={16} color={Theme.colors.secondary} />
            <Text style={styles.actionBtnText}>PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => exportInvoiceExcel(item)}>
            <Ionicons name="grid-outline" size={16} color={Theme.colors.success} />
            <Text style={styles.actionBtnText}>Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteInvoice(item._id)}>
            <Ionicons name="trash-outline" size={16} color={Theme.colors.error} />
            <Text style={styles.actionBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={["top"]}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Billing Records History</Text>
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={Theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Client or Invoice Number..."
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Shop Filtering Tabs Row */}
        <View style={styles.filterTabsScrollContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={SHOPS}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.filterTabsList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterTab, selectedShop === item && styles.filterTabActive]}
                onPress={() => setSelectedShop(item)}
              >
                <Text style={[styles.filterTabText, selectedShop === item && styles.filterTabTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Invoice List */}
        {loading && invoices.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Theme.colors.primary} />
            <Text style={styles.loadingText}>Fetching saved invoices...</Text>
          </View>
        ) : invoices.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            <Ionicons name="file-tray-outline" size={60} color={Theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No invoices or quotations match your criteria.</Text>
          </ScrollView>
        ) : (
          <FlatList
            data={invoices}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          />
        )}
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
    paddingVertical: 18,
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.colors.text,
  },
  filterTabsScrollContainer: {
    marginBottom: 8,
  },
  filterTabsList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  filterTab: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.colors.textSecondary,
  },
  filterTabTextActive: {
    color: "#FFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: Theme.colors.textSecondary,
    fontSize: 13,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  listContent: {
    padding: 12,
    paddingBottom: 30,
  },
  invoiceCard: {
    backgroundColor: "#FFF",
    borderRadius: Theme.roundness,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: "#FAF9F6",
  },
  shopLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: Theme.colors.secondary,
    textTransform: "uppercase",
  },
  dateLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  formatTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formatTagText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  cardBody: {
    padding: 12,
  },
  rowAlign: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 2,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    color: Theme.colors.text,
    flex: 1,
  },
  invoiceNumberText: {
    fontSize: 12,
    color: "#8E8E93",
    marginLeft: 21,
    marginBottom: 4,
  },
  projectText: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
    flex: 1,
  },
  amountBlockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 10,
    marginTop: 10,
  },
  amountLabel: {
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.colors.primary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
    backgroundColor: "#F9F9FB",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: Theme.colors.border,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Theme.colors.text,
  },
});
