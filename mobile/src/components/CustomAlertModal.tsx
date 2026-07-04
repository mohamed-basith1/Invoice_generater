import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme } from "../theme";

interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "error" | "warning" | "delete";
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  visible,
  title,
  message,
  type,
  onClose,
  onConfirm,
  confirmText,
  cancelText,
}) => {
  const isConfirm = type === "delete" || !!onConfirm;

  // Icon and colors config
  let iconName: React.ComponentProps<typeof Ionicons>["name"] = "information-circle-outline";
  let iconColor = "#2196F3";
  let iconBg = "rgba(33, 150, 243, 0.08)";
  let primaryBtnColor = "#2196F3";

  if (type === "success") {
    iconName = "checkmark-circle-outline";
    iconColor = "#22B378";
    iconBg = "rgba(34, 179, 120, 0.08)";
    primaryBtnColor = "#22B378";
  } else if (type === "error") {
    iconName = "alert-circle-outline";
    iconColor = "#D32F2F";
    iconBg = "rgba(211, 47, 47, 0.08)";
    primaryBtnColor = "#D32F2F";
  } else if (type === "warning" || type === "delete") {
    iconName = type === "delete" ? "trash-outline" : "warning-outline";
    iconColor = "#D32F2F";
    iconBg = "rgba(211, 47, 47, 0.08)";
    primaryBtnColor = "#D32F2F";
  }

  const handleConfirm = () => {
    onClose();
    if (onConfirm) {
      setTimeout(() => {
        onConfirm();
      }, 100);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Top circular icon header */}
          <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <Ionicons name={iconName} size={32} color={iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons footer */}
          <View style={styles.footer}>
            {isConfirm ? (
              <>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>{cancelText || "Cancel"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: primaryBtnColor }]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmBtnText}>{confirmText || (type === "delete" ? "Delete" : "Confirm")}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.okBtn, { backgroundColor: primaryBtnColor }]}
                onPress={onClose}
              >
                <Text style={styles.okBtnText}>{confirmText || "OK"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1C1C1E",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#636366",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  okBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  okBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFF",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#636366",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15,
  },
});
