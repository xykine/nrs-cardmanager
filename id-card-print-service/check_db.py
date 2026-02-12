
import sqlite3
import sys

ids = [
    "fed28f71-cdc0-4812-b479-ad1219418292",
    "9bc2655d-ac2a-4409-9443-e61fc709f901",
    "bfe6ef91-4874-4267-9a16-e1fe75632a29",
    "574c42ce-cc9d-4549-80a6-ed1682d98b43",
    "911566d6-18d9-44cb-a2b5-07aa1c48fc3e",
    "274b8312-1500-47e9-a136-599f177e0c6b",
    "808eccc1-d6b1-43bf-beb7-92933fa03b53",
    "5f38b0e8-2b15-4d75-948a-eb7302cfbcff"
]

db_path = "print.db"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"Checking {len(ids)} IDs in {db_path}...")
    
    for eid in ids:
        # Check Employee
        cursor.execute("SELECT id, name, photoPresent FROM employees WHERE id = ?", (eid,))
        emp = cursor.fetchone()
        
        if not emp:
            print(f"[MISSING] Employee ID {eid} not found in DB")
            continue
            
        # Check Card
        cursor.execute("SELECT id, photoData FROM cards WHERE employeeId = ?", (eid,))
        card = cursor.fetchone()
        
        status = []
        if not card:
            status.append("NO_CARD")
        elif not card[1]: # photo_data
            status.append("NO_PHOTO_DATA")
        else:
            status.append("OK")
            
        print(f"[FOUND] {eid} Name: {emp[1]}, PhotoPresent: {emp[2]}, Status: {', '.join(status)}")

    conn.close()

except Exception as e:
    print(f"Error: {e}")
