# RetailIQ — Premium AI-Powered Retail Inventory Intelligence Platform

RetailIQ is an enterprise-grade retail inventory management platform with an integrated conversational AI inventory assistant. Built for retail operations directors, merchandisers, and inventory analysts, RetailIQ transforms raw relational database tables into actionable stock intelligence, real-time valuation metrics, and natural-language query resolution.

---

## 1. System Architecture

```
                       RetailIQ Architecture
┌─────────────────────────────────────────────────────────────────┐
│                    React 19 + TypeScript SPA                    │
│      (Plus Jakarta Sans · JetBrains Mono · Tailwind CSS v4)      │
│  ┌───────────────┬────────────────┬──────────────┬───────────┐  │
│  │ Dashboard KPI │ Inventory Grid │ AI Assistant │ Analytics │  │
│  └───────────────┴────────────────┴──────────────┴───────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ REST API (JSON)
┌────────────────────────────────▼────────────────────────────────┐
│                   Full-Stack Express Server                     │
│  ┌─────────────────────────────┬─────────────────────────────┐  │
│  │    Inventory Store Layer    │    Hybrid Query Router      │  │
│  │ (Filters, Sort, Pagination) │ (Regex Patterns + Gemini)   │  │
│  └─────────────────────────────┴─────────────────────────────┘  │
└────────────────┬───────────────────────────────┬────────────────┘
                 │                               │
        ┌────────▼─────────┐            ┌────────▼────────┐
        │ MySQL atliq_db   │            │ Google Gemini   │
        │ t_shirts / disc  │            │ 3.8 Flash SDK   │
        └──────────────────┘            └─────────────────┘
```

---

## 2. Core Features

### 1. Modern Inventory Analytics Dashboard
- **4 Key Performance Indicators (KPIs):**
  - **Total Products:** Total distinct SKU variants cataloged in database.
  - **Total Units in Stock:** Real aggregated physical warehouse unit count.
  - **Inventory Value:** Accurate asset valuation computed as `SUM(price * stock_quantity)`.
  - **Low-Stock Products:** Dynamic alert counter governed by a configurable threshold rule.
- **Visual Analytics:**
  - **Stock by Brand:** Horizontal bar chart sorted by stock volume.
  - **Inventory Distribution:** Precision donut visualization with brand percentage breakdowns.
  - **Stock by Size:** Bar distribution spanning sizes XS, S, M, L, and XL.
  - **Inventory Value by Brand:** Capital valuation chart showing held asset distribution.
- **Low-Stock Alert Table:** Instant visibility into critical SKUs with status badges and threshold rule context.

### 2. AI Inventory Assistant
- **Predefined SQL Pattern Matching:** Exact regex-driven query translation corresponding to tested `inventory_queries.py` patterns.
- **Google Gemini 3.8 Flash Integration:** Server-side natural-language reasoning that dynamically constructs safe read-only SQL queries.
- **Rich Structured Presentation:**
  - Concise natural-language answers.
  - Highlighted metric badges for numeric queries.
  - Interactive SQL disclosure drawer with one-click copy button.
  - Full data tables for multi-row database responses.
- **Pre-loaded Benchmark Queries:**
  - *"How many Nike XS white T-shirts are available?"*
  - *"How many white Levi's T-shirts do we have?"*
  - *"What is the total inventory value?"*
  - *"What is the revenue from selling Levi's T-shirts?"*
  - *"Show stock quantities by brand."*
  - *"Which products have low stock?"*

### 3. Product Inventory Management Table
- **Multi-Filter Combination:** Brand (Nike, Levi, Van Heusen, Adidas), Color (White, Black, Red, Blue), Size (XS–XL), and Stock Status.
- **Full-Text Live Search:** Instant search across Brand, Color, Size, and Product ID.
- **Interactive Sorting:** Multi-column sorting by ID, Brand, Price, Stock Quantity, and Inventory Value.
- **Pagination & Export:** Server-side pagination with CSV export functionality.

### 4. Dedicated Analytics Page
- **Brand Comparison Matrix:** SKU count, unit volume, and capital valuation breakdown.
- **Fabric Colorway Distribution:** Visualizing color preferences and volume.
- **Inventory Concentration:** Pareto analysis identifying top brand concentration.
- **Financial Disclosure:** Clear distinction between inventory asset valuation (`price * stock_quantity`) and net sales revenue (post-discount realization).

### 5. Remote MySQL Integration & Schema Explorer
- **Live Database Connection:** Connect to any remote MySQL instance (AWS RDS, PlanetScale, DigitalOcean, Supabase, or local MySQL) with credentials secured server-side.
- **Dynamic Schema Introspection:** Introspects table names, row counts, data types, primary keys, and foreign keys in real time.
- **Safe Read-Only SQL Playground:** Interactive sandbox for testing read-only SQL queries with automatic rejection of destructive commands (`DROP`, `DELETE`, `UPDATE`, `ALTER`).
- **Benchmark Natural Language to SQL Queries:**
  - *"Find the 5 cheapest shirts"*
  - *"Show products with stock below 10"*
  - *"Calculate inventory value by brand"*
  - *"Compare monthly sales"*
  - *"Show all products in alphabetical order starting with brand name"*

---

## 3. Database Schema (`atliq_tshirts`)

```sql
-- Table 1: Product inventory
CREATE TABLE t_shirts (
    t_shirt_id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(50) NOT NULL,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(10) NOT NULL,
    price INT NOT NULL,
    stock_quantity INT DEFAULT 0
);

-- Table 2: Product discounts
CREATE TABLE discounts (
    t_shirt_id INT PRIMARY KEY,
    pct_discount DECIMAL(5,2) NOT NULL,
    FOREIGN KEY (t_shirt_id) REFERENCES t_shirts(t_shirt_id)
);
```

---

## 4. Connecting Your MySQL Database

### Option A: Via the Web UI (Zero Code)
1. In RetailIQ, navigate to **Settings > Remote MySQL & Schema Explorer**.
2. Enter your MySQL connection credentials:
   - **Host:** e.g. `localhost` or your remote cloud endpoint
   - **Port:** `3306`
   - **User & Password:** database user credentials
   - **Database:** `atliq_tshirts` (or custom retail database)
   - **SSL:** toggle for cloud databases (AWS RDS, PlanetScale, DigitalOcean)
3. Click **Connect to MySQL**.
4. The schema explorer will immediately introspect all tables, column types, and sample records.

### Option B: Via Python FastAPI Bridge
1. Run the included bridge in `/backend/bridge_api.py`:
   ```bash
   pip install fastapi uvicorn pymysql
   python -m uvicorn backend.bridge_api:app --reload --port 8000
   ```
2. In Settings, configure the Python bridge URL: `http://localhost:8000`.

---

## 5. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start full-stack development server
npm run dev
```

Visit `http://localhost:3000` to access RetailIQ.

---

## 6. Verification & Testing Checklist

- [x] **Natural Language to SQL:** Generates read-only SQL from natural language with charts and metrics.
- [x] **Remote MySQL Connection:** Supports live connections with schema introspection and connection status.
- [x] **Safe SQL Sandbox:** Interactive query runner with security guard against non-SELECT statements.
- [x] **Dashboard:** KPI cards update with genuine calculations from `atliq_tshirts`.
- [x] **Sorting & Filters:** Brand, Color, Size, Stock Status, and Alphabetical (A-Z, Z-A) sorting work without conflicts.
- [x] **CSV Export:** Generates CSV containing current filter selection.
- [x] **Threshold Adjustment:** Changing threshold in Settings updates low-stock counters across the application.
