import psycopg2

def query_db():
    conn_str = "postgres://postgres:SecurePass2024%21@185.217.131.26:5444/admissions_flow"
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Query families
        cur.execute("SELECT id, name, status, current_stage, iop_score, support_route FROM families ORDER BY id DESC;")
        rows = cur.fetchall()
        print("=== FAMILIES ===")
        for r in rows:
            print(f"ID: {r[0]}, Name: {r[1]}, Status: {r[2]}, Current Stage: {r[3]}, IOP: {r[4]}, Route: {r[5]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    query_db()
