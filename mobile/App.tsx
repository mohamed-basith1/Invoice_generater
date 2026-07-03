import { Buffer } from "buffer";
global.Buffer = global.Buffer || Buffer;

import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "./src/theme";

// Screens
import InvoiceScreen from "./src/screens/InvoiceScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = "receipt";

            if (route.name === "Create") {
              iconName = focused ? "receipt" : "receipt-outline";
            } else if (route.name === "History") {
              iconName = focused ? "time" : "time-outline";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: Theme.colors.secondary,
          tabBarInactiveTintColor: Theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: Theme.colors.border,
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        })}
      >
        <Tab.Screen 
          name="Create" 
          component={InvoiceScreen} 
          options={{ title: "Create Invoice" }}
        />
        <Tab.Screen 
          name="History" 
          component={HistoryScreen} 
          options={{ title: "History Records" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
