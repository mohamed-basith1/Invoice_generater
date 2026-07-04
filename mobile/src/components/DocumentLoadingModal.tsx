import React from "react";
import { Modal, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Theme } from "../theme";

interface DocumentLoadingModalProps {
  visible: boolean;
  message?: string;
}

export const DocumentLoadingModal: React.FC<DocumentLoadingModalProps> = ({
  visible,
  message = "Please wait for some time, compilation is in progress...",
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={Theme.colors.secondary} style={styles.spinner} />
          <Text style={styles.title}>Generating Document</Text>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 300,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  spinner: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 13.5,
    color: "#636366",
    textAlign: "center",
    lineHeight: 20,
  },
});
