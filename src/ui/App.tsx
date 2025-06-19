import * as React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ReceiptIcon from "@mui/icons-material/ReceiptOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import InvoicePage from "./pages/InvoicePage";
import QuotationPage from "./pages/QuotationPage";
import SettingsPage from "./pages/settingsPage";

const drawerWidth = 240;

// Sidebar navigation items
const menuItems = [
  { text: "Invoice", path: "/", icon: <ReceiptIcon /> },
  { text: "Quotation", path: "/quotation", icon: <PaymentsIcon /> },
  { text: "Settings", path: "/settings", icon: <SettingsIcon /> },
];

export default function CustomSidebar() {
  return (
    <Router>
      <Box
        sx={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          boxSizing: "border-box",
        }}
      >
        <CssBaseline />

        {/* Sidebar */}
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              bgcolor: "#1E1E2D", // Dark background
              color: "#fff",
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <Toolbar>
            <Typography variant="h6" sx={{ color: "#fff", ml: 2 }}>
              Invoice App
            </Typography>
          </Toolbar>
          <Divider sx={{ borderColor: "#444" }} />

          <List>
            {menuItems.map((item) => (
              <NavItem key={item.text} {...item} />
            ))}
          </List>
        </Drawer>

        {/* Main Content */}

        <Routes>
          <Route path="/" element={<InvoicePage />} />
          <Route path="/quotation" element={<QuotationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Box>
    </Router>
  );
}

// Custom navigation item component
const NavItem = ({ text, path, icon }) => {
  const location = useLocation();

  return (
    <ListItem>
      <ListItemButton
        component={Link}
        to={path}
        sx={{
          backgroundColor:
            location.pathname === path ? "#22b378" : "transparent",
          borderRadius: "8px",
        }}
      >
        <ListItemIcon sx={{ color: "#fff" }}>{icon}</ListItemIcon>
        <ListItemText primary={text} />
      </ListItemButton>
    </ListItem>
  );
};
