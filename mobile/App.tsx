import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;

import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Screens
import InvoiceScreen from "./src/screens/InvoiceScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

export default function App() {
  const [activeScreen, setActiveScreen] = useState<"Create" | "History">("Create");
  const [selectedInvoiceToEdit, setSelectedInvoiceToEdit] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = () => setDrawerOpen(!drawerOpen);

  // Reusable navigation mock structure matching standard stack flow
  const navigationMock = {
    navigate: (screenName: string, params?: any) => {
      if (screenName === "Create") {
        setSelectedInvoiceToEdit(params?.invoice || null);
        setActiveScreen("Create");
      } else if (screenName === "History") {
        setActiveScreen("History");
      }
    },
    goBack: () => {
      setSelectedInvoiceToEdit(null);
      setActiveScreen("History");
    },
  };

  const routeMock = {
    params: {
      invoice: selectedInvoiceToEdit,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#1E1E2D" }}>
      <StatusBar style="light" />

      {/* Main active screen */}
      <View style={{ flex: 1 }}>
        {activeScreen === "Create" ? (
          <InvoiceScreen
            navigation={navigationMock}
            route={routeMock}
            onOpenMenu={toggleDrawer}
          />
        ) : (
          <HistoryScreen
            navigation={navigationMock}
            route={routeMock}
            onOpenMenu={toggleDrawer}
          />
        )}
      </View>

      {/* Slide Drawer panel overlay and black transparent backdrop */}
      {drawerOpen && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={() => setDrawerOpen(false)}
        />
      )}

      {/* Side Menu Panel */}
      {drawerOpen && (
        <View style={styles.drawer}>
          {/* Header inside drawer */}
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerHeaderTitle}>Navigation</Text>
            <TouchableOpacity onPress={() => setDrawerOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Menu Items List */}
          <View style={styles.menuList}>
            {/* Create Invoice / Billing option */}
            <TouchableOpacity
              style={[styles.menuItem, activeScreen === "Create" && styles.menuItemActive]}
              onPress={() => {
                setSelectedInvoiceToEdit(null);
                setActiveScreen("Create");
                setDrawerOpen(false);
              }}
            >
              <Ionicons
                name="receipt"
                size={20}
                color={activeScreen === "Create" ? "#FFF" : "#A0A0B0"}
                style={{ width: 24 }}
              />
              <Text style={[styles.menuItemText, activeScreen === "Create" && styles.menuItemTextActive]}>
                Billing
              </Text>
            </TouchableOpacity>

            {/* Invoices History Records option */}
            <TouchableOpacity
              style={[styles.menuItem, activeScreen === "History" && styles.menuItemActive]}
              onPress={() => {
                setActiveScreen("History");
                setDrawerOpen(false);
              }}
            >
              <Ionicons
                name="time"
                size={20}
                color={activeScreen === "History" ? "#FFF" : "#A0A0B0"}
                style={{ width: 24 }}
              />
              <Text style={[styles.menuItemText, activeScreen === "History" && styles.menuItemTextActive]}>
                History
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 999,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 260,
    backgroundColor: "#1E1E2D", // Dark sidebar background matching desktop
    zIndex: 1000,
    paddingTop: 60,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: "#2B2B3D",
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  drawerHeaderTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#2B2B3D",
    marginBottom: 20,
  },
  menuList: {
    gap: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemActive: {
    backgroundColor: "#22B378", // Emerald active brand green
  },
  menuItemText: {
    color: "#A0A0B0",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 4,
  },
  menuItemTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },
});
