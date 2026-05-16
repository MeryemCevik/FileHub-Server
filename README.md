# Android Local File Server - Version 2 (MIAGE)

## 🎯 Project Overview
This project transforms an Android smartphone into a high-performance local HTTP file server. It allows users to browse, download, and manage files from any device on the same local network using a modern web interface.

**Version 2** focuses on a complete UI/UX overhaul using **Material 3**, professional branding, and a clean separation between the Android control application and the Web file explorer.

---

## 🧱 Architecture (V2)

### 📱 Android Application
- **UI (Jetpack Compose)**: A modern, minimalist interface inspired by Google Drive and Notion. It uses Material 3 Cards, professional typography, and a refined color palette (Purple/Green).
- **Control Layer**: Manages the lifecycle of the HTTP server (Start/Stop), network configuration (Port), and displays connection information (IP Address).
- **MVVM Pattern**: 
    - `MainActivity`: Entry point, handles permissions and UI hosting.
    - `MainScreen`: Refactored UI component with distinct sections for status, control, and information.
    - `MainViewModel`: Reactive logic managing server state and network parameters.

### ⚙️ Backend (HttpServer)
- **Engine**: Powered by `NanoHTTPD`, customized for Android's file system.
- **File Exploration**: Efficiently serves directory structures and files from `ExternalStorage`.
- **API Layer**: Provides a JSON endpoint (`/api/files`) for the dynamic web interface.
- **Security**: Handles storage permissions (including `MANAGE_EXTERNAL_STORAGE` for Android 11+).

### 🌐 Web Interface
- **Technology**: Built with HTML5, Vanilla JS, and **Tailwind CSS**.
- **User Experience**: A responsive, "Google Drive like" explorer with breadcrumb navigation and instant downloads.

---

## 🎨 Design System & Branding
- **Branding**: Introduced "FileHub Local" with a minimalist logo (Share/Network icon).
- **Color Palette**: 
    - **Primary**: Soft Purple (#6750A4)
    - **Accent**: Success Green (#2E7D32)
    - **Background**: Light Grey (#F6F7F9)
- **UI Principles**: Card-based grouping, clean spacing (24dp padding), and high visual hierarchy.

---

## 🧠 Key Improvements in V2
1. **Modernized UX**: Transitioned from a basic functional UI to a professional, academic-standard interface.
2. **Separation of Concerns**: Stricter boundary between Android-side control and Web-side exploration.
3. **Improved Reliability**: Enhanced file system access logic and error handling.
4. **MIAGE Master Level Quality**: Code structure and documentation updated to meet high academic standards.

---

## 🚀 How to Run
1. Launch the app on your Android device.
2. Grant the necessary storage permissions.
3. Click **START SERVER**.
4. Enter the displayed URL (e.g., `http://192.168.1.15:8080`) in any web browser on your network.
