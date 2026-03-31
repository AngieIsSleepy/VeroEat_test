# 🍎 VeroEat - Personal Food Safety Assistant

**Scan • Decide • Stay Safe**

VeroEat is a personal food safety assistant that helps users quickly decide whether a food product is safe to buy, eat, and keep. Instead of generic ratings, VeroEat provides a clear **Safe, Caution, or Avoid** recommendation based on your personalized allergy profile, dietary preferences, and real-time recall data.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **Personalized Protection** | Detects ingredients and hidden allergen risks based on custom user profiles. |
| **Smart Scanner** | Scans barcodes to fetch product ingredients and determine safety instantly. |
| **Recall Risk Check** | Cross-references products against recall databases to prevent real safety risks. |
| **Virtual Inventory** | Tracks expiration dates and sends reminders before your food expires. |
| **Smart Alternatives** | Recommends safe alternative products if a scanned item triggers a warning. |

---

## 🛠 Prerequisites

Before running the project locally, ensure you have the following installed:

* **Node.js** (LTS version recommended) & **npm**
* **Python** (Version 3.10 or higher)
* **Expo Go** application installed on your physical mobile device (iOS or Android)

---

## 🚀 Getting Started

VeroEat consists of a React Native frontend (Expo) and a Jac-powered AI backend. Follow the steps below to run both environments simultaneously.

### 1. Backend Setup (Jac & Python)

The backend handles the core logic, AI recommendations, and API communications.

1. Navigate to the backend directory:
   `cd jac_backend/jactastic`

2. Install the required environment variable package:
   `pip install python-dotenv`

3. Create a `.env` file in the `jac_backend/jactastic` directory and add your API key (do not use quotes):
   `EXPO_PUBLIC_API_KEY=your_actual_api_key_here`

4. Start the Jac backend server:
   `python server.py`
   
   > **Important:** Keep this terminal running. If you modify any `.jac` logic files, you must restart this server for the changes to take effect.

---

### 2. Frontend Setup (Expo)

The frontend is built with Expo and requires a connection to your local backend.

1. **Find your computer's local IPv4 address:**
   * **Windows:** Open a new terminal and run `ipconfig`
   * **Mac/Linux:** Open a new terminal and run `ifconfig`

2. **Update the frontend API configuration:**
   * Open the frontend code where the API calls are made.
   * Replace the existing backend URL with your computer's IPv4 address (e.g., `http://192.168.1.XX:8000`).

3. **Install frontend dependencies** (run this from the root project folder):
   `npm install`

4. **Start the Expo development server:**
   `npx expo start`

5. **Open the App:**
   * Scan the QR code displayed in the terminal using your phone's camera (iOS) or the Expo Go app (Android).
   * Ensure your phone and computer are connected to the **same Wi-Fi network**.

---


## 💡 Development Tips

* **Live Reloading:** Frontend changes will sync automatically to your phone. If it gets stuck, press `r` in the Expo terminal to force a reload.
* **Security:** Never commit your `.env` file to version control. Ensure `.env` is listed in your `.gitignore` file to protect your API keys.

---