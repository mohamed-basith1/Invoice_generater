import { useState } from "react";
import {
  Routes,
  Route,
  Link,
  useLocation,
  BrowserRouter,
  HashRouter,
} from "react-router-dom";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import AppBar from "@mui/material/AppBar";
import IconButton from "@mui/material/IconButton";

// Icons
import ReceiptIcon from "@mui/icons-material/ReceiptOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import MenuIcon from "@mui/icons-material/Menu";

// Pages
import InvoicePage from "./pages/InvoicePage";
import HistoryPage from "./pages/historyPage";
import SettingsPage from "./pages/settingsPage";
import LogoImage from "./logo.png";

const Router =
  import.meta.env.MODE === "development" ? BrowserRouter : HashRouter;
const drawerWidth = 240;

// Sidebar navigation items
const menuItems = [
  { text: "Billing", path: "/", icon: <ReceiptIcon /> },
  { text: "History", path: "/history", icon: <PaymentsIcon /> },
];

export default function CustomSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerToggle = (open: boolean) => () => {
    setDrawerOpen(open);
  };

  return (
    <Router>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          width: "100vw",
          bgcolor: "#fcfcfd",
          boxSizing: "border-box",
        }}
      >
        <CssBaseline />

        {/* Top App Bar with Burger Menu fdf*/}
        <AppBar
          position="static"
          sx={{
            bgcolor: "#1E1E2D", // Dark Theme
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            borderBottom: "1px solid #2b2b3d",
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle(true)}
                sx={{ mr: 1 }}
              >
                <MenuIcon />
              </IconButton>
              <img src={LogoImage} style={{ width: "32px", height: "32px", borderRadius: "6px" }} alt="Logo" />
              <Typography variant="h6" fontWeight="bold" sx={{ letterSpacing: 0.5 }}>
                SZ SIGNAGE & STICKER ZONE
              </Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ opacity: 0.8, display: { xs: "none", sm: "block" } }}>
              Billing & History Portal
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Side Collapsible Drawer */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={handleDrawerToggle(false)}
          sx={{
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              bgcolor: "#1E1E2D",
              color: "#fff",
              borderRight: "1px solid #2b2b3d",
              padding: 2,
            },
          }}
        >
          {/* Header inside drawer */}
          <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2, px: 1 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <img src={LogoImage} style={{ width: "36px", height: "36px", borderRadius: "8px" }} alt="Logo" />
              <Typography variant="h6" fontWeight="bold">
                Navigation
              </Typography>
            </Box>
            <IconButton color="inherit" onClick={handleDrawerToggle(false)}>
              <MenuIcon />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: "#2b2b3d", mb: 2 }} />

          <List>
            {menuItems.map((item) => (
              <NavItem key={item.text} {...item} onClick={handleDrawerToggle(false)} />
            ))}
          </List>
        </Drawer>

        {/* Main Content Workspace */}
        <Box sx={{ flexGrow: 1, overflow: "auto", width: "100%", height: "100%" }}>
          <Routes>
            <Route path="/" element={<InvoicePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

// NavItem Component
const NavItem = ({ text, path, icon, onClick }) => {
  const location = useLocation();

  return (
    <ListItem disablePadding sx={{ mb: 1 }}>
      <ListItemButton
        component={Link}
        to={path}
        onClick={onClick}
        sx={{
          backgroundColor:
            location.pathname === path ? "#22b378" : "transparent",
          borderRadius: "8px",
          color: "#fff",
          "&:hover": {
            backgroundColor:
              location.pathname === path ? "#22b378" : "rgba(255,255,255,0.08)",
          },
        }}
      >
        <ListItemIcon sx={{ color: "#fff", minWidth: "40px" }}>{icon}</ListItemIcon>
        <ListItemText primary={text} primaryTypographyProps={{ fontWeight: 500 }} />
      </ListItemButton>
    </ListItem>
  );
};
