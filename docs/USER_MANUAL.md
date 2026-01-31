# SimpleLIMS User Manual

Welcome to **SimpleLIMS-Offline**, the laboratory information management system designed for small clinical laboratories.

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Getting Started](#getting-started)
3. [Managing Patients & Orders](#managing-patients--orders)
4. [Sample Processing](#sample-processing)
5. [Instrument Integration](#instrument-integration)
6. [Results & Reporting](#results--reporting)
7. [System Administration](#system-administration)
8. [Troubleshooting](#troubleshooting)

---

## Core Concepts

SimpleLIMS is organized around the following workflow:

1.  **Patient Registration**: Enter patient demographics.
2.  **Order Creation**: Assign Tests (Panels) to a Patient Sample.
3.  **Sample Processing**: Results are entered manually or received from Instruments.
4.  **Verification**: Technician reviews and approves results.
5.  **Reporting**: Final PDF report is generated for the doctor/patient.

---

## Getting Started

### First Run
When you launch SimpleLIMS for the first time, you will be greeted by the **Setup Wizard**.
1.  **Select Language**: Choose your interface language.
2.  **Lab Information**: Enter your Lab Name, Address, and Contact info (appears on reports).
3.  **Admin Account**: Create the primary administrator account (keep your password safe!).

### Login
Use the username and password created during setup to log in.

---

## Managing Patients & Orders

### Adding a Patient
1.  Navigate to **Patients**.
2.  Click **New Patient**.
3.  Fill in the required fields (Name, Date of Birth, Gender).
4.  Click **Save**.

### Creating an Order (Test Request)
1.  Navigate to **Orders** (or create directly from Patient page).
2.  Select the **Patient**.
3.  Select the **Test Panels** (e.g., CBC, Lipid Panel).
4.  A **Sample ID** is automatically generated (e.g., `SID-20231027-001`). You can print this barcode.

---

## Sample Processing

### Barcode Labeling
1.  Use the **Print Barcode** button to generate a label.
2.  Stick this label on the collection tube.
3.  Instruments scan this barcode to query the LIMS (Bidirectional) or identify results.

---

## Instrument Integration

SimpleLIMS supports connecting analyzers via **Serial (RS232)** or **TCP/IP**.

### Connecting an Instrument
1.  Go to **Instruments**.
2.  Click **Add Instrument**.
3.  Select the Protocol (ASTM 1381, HL7, or Custom CSV).
4.  Configure connection settings (COM Port for Serial, IP/Port for TCP).
5.  Click **Connect**.

### Unmatched Data
If the system receives results for a Sample ID it doesn't recognize (or if the barcode was misread), the results go to **Unmatched Data**.
1.  Go to **Unmatched Data**.
2.  Find the result.
3.  Click **Claim** and assign it to the correct Patient/Order.

---

## Results & Reporting

### Entering Results
1.  Go to **Results** or **Worklist**.
2.  Find the pending test.
3.  Enter the numeric value. The system automatically flags High/Low values based on reference ranges.

### Verification
1.  Technicians verify results to ensure accuracy.
2.  Status changes from `Pending` -> `Completed` -> `Validated`.

### Printing Reports
1.  Go to **Reports**.
2.  Select the order.
3.  Click **Print** or **Export PDF**.

---

## System Administration

### User Management
*   **Admins** can create new users (Technicians, Lab Managers).
*   Go to **Users** to manage accounts and reset passwords.

### Backup & Restore
*   **Auto-Backup**: Configurable in **Settings**.
*   **Manual Backup**: Go to **Settings > Backup** to save a snapshot of your database.
*   **Restore**: Use a backup file to restore the system state (CAUTION: Overwrites current data).

### License Activation
*   Navigate to **Settings > License**.
*   Enter your valid License Key to unlock Professional features and remove trial limits.

---

## Troubleshooting

### Connection Issues
*   Ensure the COM port is correct and not used by another software.
*   Check the cable connection.

### Missing Results
*   Check **Unmatched Data** folder.
*   Verify the Instrument sent the correct Sample ID.

---

*SimpleLIMS-Offline v0.1.0*
