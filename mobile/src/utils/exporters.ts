import * as Sharing from "expo-sharing";
import { documentDirectory, downloadAsync } from "expo-file-system/src/legacy/FileSystem";
import { Alert } from "react-native";
import { StoredInvoice } from "../types";
import { API_URL } from "../config";

// ==========================================
// 1. PDF EXPORTER (OFFLOADED TO BACKEND)
// ==========================================
export const exportInvoicePDF = async (invoice: StoredInvoice) => {
  try {
    const url = `${API_URL}/api/invoices/${invoice._id}/pdf`;
    const safeShop = invoice.shop.replace(/\s+/g, "_");
    const safeInvNum = invoice.invoiceNumber || "DRAFT";
    const filename = `${safeShop}_${safeInvNum}.pdf`;
    const targetUri = `${documentDirectory}${filename}`;

    const downloadRes = await downloadAsync(url, targetUri);
    if (downloadRes.status !== 200) {
      Alert.alert("Error", "Failed to generate PDF file on server.");
      return;
    }

    // Share PDF using Native Sharing dialog
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/pdf",
      dialogTitle: "Download PDF Invoice",
      UTI: "com.adobe.pdf",
    });
  } catch (err) {
    Alert.alert("Error", "Failed to download invoice PDF.");
  }
};

// ==========================================
// 2. EXCEL EXPORTER (OFFLOADED TO BACKEND)
// ==========================================
export const exportInvoiceExcel = async (invoice: StoredInvoice) => {
  try {
    const url = `${API_URL}/api/invoices/${invoice._id}/excel`;
    const safeShop = invoice.shop.replace(/\s+/g, "_");
    const safeInvNum = invoice.invoiceNumber || "DRAFT";
    const filename = `${safeShop}_${safeInvNum}.xlsx`;
    const targetUri = `${documentDirectory}${filename}`;

    const downloadRes = await downloadAsync(url, targetUri);
    if (downloadRes.status !== 200) {
      Alert.alert("Error", "Failed to generate Excel file on server.");
      return;
    }

    // Trigger Native Share Dialog
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Download Excel Spreadsheet",
      UTI: "com.microsoft.excel.xlsx",
    });
  } catch (err) {
    Alert.alert("Error", "Failed to download invoice Excel sheet.");
  }
};
