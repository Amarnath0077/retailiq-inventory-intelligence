"""
RetailIQ — Python FastAPI Bridge for atliq_tshirts MySQL Database
=================================================================
This module bridges your existing Python 3.11 backend (Streamlit / LangChain / PyMySQL)
to the RetailIQ enterprise interface.

Compatible with your existing modules:
- database/db_connection.py
- database/inventory.py
- database/inventory_queries.py
"""

import os
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymysql

app = FastAPI(
    title="RetailIQ Python Bridge",
    description="REST API proxy for atliq_tshirts database and inventory query execution.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Configuration (reads environment variables or falls back to standard local MySQL)
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "root")
DB_NAME = os.getenv("DB_NAME", "atliq_tshirts")
DB_PORT = int(os.getenv("DB_PORT", "3306"))

def get_db():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        cursorclass=pymysql.cursors.DictCursor
    )

class QueryRequest(BaseModel):
    query: str
    threshold: Optional[int] = 15

@app.get("/api/health")
def health():
    try:
        conn = get_db()
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as cnt FROM t_shirts;")
            res = cursor.fetchone()
        conn.close()
        return {
            "status": "connected",
            "database": DB_NAME,
            "host": f"{DB_HOST}:{DB_PORT}",
            "tables": ["t_shirts", "discounts"],
            "total_tshirts": res["cnt"] if res else 0
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "database": DB_NAME,
            "error": str(e)
        }

@app.get("/api/inventory")
def get_inventory(
    brand: Optional[str] = None,
    color: Optional[str] = None,
    size: Optional[str] = None,
    sort: Optional[str] = "Alphabetical (A-Z)",
    limit: int = 50
):
    try:
        conn = get_db()
        sql = """
            SELECT t.t_shirt_id, t.brand, t.color, t.size, t.price, t.stock_quantity,
                   (t.price * t.stock_quantity) as inventory_value,
                   COALESCE(d.pct_discount, 0) as pct_discount
            FROM t_shirts t
            LEFT JOIN discounts d ON t.t_shirt_id = d.t_shirt_id
            WHERE 1=1
        """
        params = []
        if brand and brand != 'all':
            sql += " AND LOWER(t.brand) = %s"
            params.append(brand.lower())
        if color and color != 'all':
            sql += " AND LOWER(t.color) = %s"
            params.append(color.lower())
        if size and size != 'all':
            sql += " AND UPPER(t.size) = %s"
            params.append(size.upper())

        # Sorting utility supporting 'Alphabetical (A-Z)' and 'Alphabetical (Z-A)'
        if sort in ("Alphabetical (A-Z)", "alpha_asc"):
            sql += " ORDER BY t.brand ASC, t.color ASC, t.size ASC"
        elif sort in ("Alphabetical (Z-A)", "alpha_desc"):
            sql += " ORDER BY t.brand DESC, t.color ASC, t.size ASC"
        elif sort == "price_asc":
            sql += " ORDER BY t.price ASC"
        elif sort == "price_desc":
            sql += " ORDER BY t.price DESC"
        elif sort == "stock_desc":
            sql += " ORDER BY t.stock_quantity DESC"
        else:
            sql += " ORDER BY t.t_shirt_id ASC"

        sql += f" LIMIT {limit};"

        with conn.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall()
        conn.close()
        return {"products": rows, "count": len(rows), "sortApplied": sort}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query")
def execute_query(req: QueryRequest):
    """
    Executes an inventory question via your existing inventory_queries.py
    or returns structured SQL execution result.
    """
    # Integrate here with your tested inventory_queries module:
    # from database.inventory_queries import execute_inventory_query
    # answer, sql = execute_inventory_query(req.query)
    
    return {
        "query": req.query,
        "answer": f"Processed via Python backend for query: {req.query}",
        "queryType": "python_backend",
        "sqlQuery": "SELECT SUM(stock_quantity) FROM t_shirts;"
    }

if __name__ == "__main__":
    import uvicorn
    print(f"Starting RetailIQ Python Bridge on port 8000 (Target DB: {DB_NAME})...")
    uvicorn.run("bridge_api:app", host="0.0.0.0", port=8000, reload=True)
