# 📸 Visual Guide - UI Walkthrough

This document describes what each page looks like in the RIS application.

---

## 🔐 Login Page

**URL**: `/login`

**Description**: Clean, professional login interface with medical-themed design.

**Features**:
- Blue gradient background (from-blue-50 to-indigo-100)
- White card with shadow
- Blue circular icon with document symbol
- "RIS Login" heading
- "Radiology Information System" subtitle
- Email input field
- Password input field
- "Sign In" button (blue)
- Default credentials shown below form
- Footer with copyright

**Colors**:
- Primary: Blue (#3b82f6)
- Background: Gradient blue-indigo
- Card: White with shadow

---

## 📋 Worklist Dashboard

**URL**: `/dashboard`

**Description**: Main working area showing patient studies from PACS.

**Layout**:
```
┌──────────────────────────────────────┐
│  Navbar (Blue stripe)                │
├──────────────────────────────────────┤
│  📊 Worklist                         │
│  View and report patient studies...  │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Search Filters Card            │ │
│  │ [Patient Name] [ID]            │ │
│  │ [Start Date] [End Date]        │ │
│  │ [Apply] [Clear]                │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Studies Table                  │ │
│  │ Name | ID | Date | Modality... │ │
│  │ ─────────────────────────────  │ │
│  │ John Doe | 12345 | Oct 15...  │ │
│  │ Jane Smith | 67890 | Oct 14.. │ │
│  │ ...                            │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Features**:
- Search filters with 4 fields (name, ID, dates)
- Data table with columns:
  - Patient Name (bold)
  - Patient ID
  - Study Date
  - Modality (blue badge)
  - Description
  - Status (colored badge: gray/yellow/green)
  - Actions (blue link)
- Status badges:
  - 🟦 UNREPORTED (gray)
  - 🟨 DRAFT (yellow)
  - 🟩 FINAL (green)
- "Create Report" or "View Report" links
- Total studies count at bottom

**Colors**:
- Table header: Light gray background
- Hover rows: Very light gray
- Status badges: Contextual colors
- Action links: Blue

---

## 📝 Reporting Interface ⭐

**URL**: `/dashboard/report/[studyUid]`

**Description**: The star feature - split-screen reporting.

**Layout**:
```
┌─────────────────────────────────────────────┐
│  Navbar                                     │
├─────────────────────────────────────────────┤
│ ← John Doe                                  │
│   12345 • CT • Oct 15, 2025                 │
│                    [Save Draft] [Finalize]  │
├─────────────────────────────────────────────┤
│                     │                       │
│  OHIF VIEWER        │  MEDICAL REPORT       │
│  (50% width)        │  (50% width)          │
│                     │                       │
│  ┌──────────────┐  │  Author: Dr. Smith    │
│  │ [DICOM       │  │  Status: DRAFT        │
│  │  Images]     │  │                       │
│  │              │  │  ┌─────────────────┐  │
│  │  Brain CT    │  │  │ Rich Text       │  │
│  │  Scan        │  │  │ Editor          │  │
│  │              │  │  │                 │  │
│  │  [Controls]  │  │  │ [B][I][U] [H1]  │  │
│  │              │  │  │                 │  │
│  │              │  │  │ Clinical History│  │
│  │              │  │  │ ...             │  │
│  │              │  │  │                 │  │
│  │              │  │  │ Findings        │  │
│  │              │  │  │ ...             │  │
│  └──────────────┘  │  │                 │  │
│                     │  │ Impression      │  │
│                     │  │ ...             │  │
│                     │  └─────────────────┘  │
│                     │                       │
│                     │  💡 Tips box (blue)   │
└─────────────────────────────────────────────┘
```

**Left Panel**:
- Black background
- OHIF Viewer iframe (full height)
- "DICOM Viewer" label overlay
- DICOM controls (zoom, pan, window/level)
- Study images loaded from Orthanc

**Right Panel**:
- White/light gray background
- Patient info header
- Report metadata (author, status, date)
- Rich text editor with:
  - Formatting toolbar (Bold, Italic, Underline, Headings, Lists, Alignment)
  - Template sections pre-filled
  - Minimum 400px height
  - White background editor area
- Blue info box with tips
- Save Draft button (gray)
- Finalize Report button (blue)

**Editor Toolbar**:
```
[B] [I] [U] │ [H1] [H2] [P] │ [•] │ [⊏] [⊐] [⊑]
```
- Active buttons: Blue background
- Inactive buttons: Gray with hover

**Colors**:
- Left panel: Black (#000)
- Right panel: Gray-50 background
- Editor: White card with border
- Buttons: Blue primary, Gray secondary
- Tips box: Light blue background

---

## 📄 Reports Page

**URL**: `/dashboard/reports`

**Description**: List of all created reports with filtering.

**Layout**:
```
┌──────────────────────────────────────┐
│  Navbar                              │
├──────────────────────────────────────┤
│  📄 Reports                          │
│  View all radiology reports          │
│                                      │
│  🔍 Filter: [ALL] [DRAFT] [FINAL]   │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Reports Table                  │ │
│  │ Patient | Date | Modality...   │ │
│  │ ──────────────────────────────  │ │
│  │ John Doe | Oct 15 | CT | ...  │ │
│  │ Jane Smith | Oct 14 | MR |... │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Features**:
- Filter buttons (ALL/DRAFT/FINAL)
  - Active: Blue background
  - Inactive: Gray background
- Table columns:
  - Patient (Name + ID)
  - Study Date
  - Modality (blue badge)
  - Author name
  - Status badge
  - Updated timestamp
  - View action (eye icon)
- Hover effects on rows
- Total count at bottom

---

## 👥 User Management (Admin)

**URL**: `/dashboard/users`

**Description**: Admin-only page for managing system users.

**Layout**:
```
┌──────────────────────────────────────┐
│  Navbar                              │
├──────────────────────────────────────┤
│  👥 User Management       [+ Add]    │
│  Manage system users and roles       │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ Users Table                    │ │
│  │ Name | Email | Role | Status   │ │
│  │ ────────────────────────────── │ │
│  │ Admin | admin@ris | ADMIN...  │ │
│  │ Dr. Smith | smith@ | RAD...   │ │
│  │ [Edit] [Deactivate] [Delete]  │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Features**:
- "Add User" button (blue, top right)
- Users table with:
  - Full name
  - Email address
  - Role badge (Admin=purple, Radiologist=blue)
  - Status badge (Active=green, Inactive=red)
  - Action buttons (Edit/Toggle/Delete)
- Modal for creating/editing users:
  - Email field
  - Password field (create only)
  - Full name field
  - Role dropdown
  - Create/Update button
  - Cancel button

**Modal Appearance**:
- Overlay: Black semi-transparent
- Card: White, centered, rounded corners
- Form fields: Clean inputs
- Buttons: Blue primary, Gray secondary

---

## 🎨 Design System

### Colors
- **Primary Blue**: #3b82f6
- **Success Green**: #10b981
- **Warning Yellow**: #f59e0b
- **Danger Red**: #ef4444
- **Gray Scale**: 50, 100, 200...900

### Typography
- **Font**: Inter (Google Font)
- **Headings**: Bold, larger sizes
- **Body**: Regular, 14-16px
- **Small text**: 12-14px

### Components
- **Cards**: White background, shadow-sm, rounded-lg
- **Buttons**: Rounded-lg, padding, hover effects
- **Inputs**: Border, rounded-lg, focus ring
- **Badges**: Small, rounded-full, colored
- **Tables**: Striped rows, hover effects

### Spacing
- **Containers**: max-w-7xl, px-4/6/8
- **Sections**: py-8
- **Cards**: p-6
- **Form fields**: space-y-4

### Responsive
- **Mobile**: Stack vertically, hide less important columns
- **Tablet**: Partial columns, compact layout
- **Desktop**: Full width, all features visible

---

## 🎭 Interaction Patterns

### Loading States
- Spinner: Blue circular spinner
- Text: "Loading..." below spinner
- Centered on page

### Empty States
- Icon or text centered
- Gray text: "No items found"
- Helpful message

### Error States
- Red toast notification (top-right)
- Error message text
- Auto-dismiss after 5 seconds

### Success States
- Green toast notification (top-right)
- Success message
- Auto-dismiss after 3 seconds

### Hover Effects
- Table rows: Light gray background
- Buttons: Darker shade
- Links: Darker blue

### Form Validation
- Required fields marked
- Error messages below fields
- Red border on invalid inputs
- Submit disabled until valid

---

## 📱 Mobile Responsive

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Mobile Adaptations
- **Navbar**: Hamburger menu
- **Tables**: Horizontal scroll or card view
- **Split view**: Tabs instead of side-by-side
- **Forms**: Full width inputs

---

## ♿ Accessibility

- **Keyboard navigation**: Tab through all interactive elements
- **Focus indicators**: Blue ring on focus
- **ARIA labels**: On icons and buttons
- **Semantic HTML**: Proper heading hierarchy
- **Color contrast**: WCAG AA compliant

---

## 🎬 Animations

- **Page transitions**: Smooth fade-in
- **Button hovers**: Subtle color change
- **Spinners**: Rotating animation
- **Toasts**: Slide in from top-right
- **Modals**: Fade in with backdrop

---

This visual guide helps developers and designers understand the expected appearance and behavior of each page in the RIS application.
