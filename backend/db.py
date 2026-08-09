import sqlite3
from pathlib import Path
from datetime import datetime, timezone
import json

DB_PATH = Path(__file__).resolve().parent / 'shiftmate.db'

def now():
    return datetime.now(timezone.utc).isoformat()

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn

def init_db():
    conn = get_conn()
    conn.executescript('''
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'Operator',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      notes TEXT DEFAULT '',
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'NORMAL',
      last_maintenance TEXT,
      next_maintenance TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine TEXT,
      issue TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'REPORTED',
      maintenance TEXT NOT NULL DEFAULT 'Pending',
      affected_order TEXT,
      description TEXT,
      recommended_action TEXT,
      assigned_to TEXT,
      reporter_id INTEGER,
      shift_id INTEGER,
      source TEXT DEFAULT 'operator',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY(reporter_id) REFERENCES users(id),
      FOREIGN KEY(shift_id) REFERENCES shifts(id)
    );
    CREATE TABLE IF NOT EXISTS issue_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      actor TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS handovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER,
      summary TEXT NOT NULL,
      quality_score INTEGER DEFAULT 0,
      missing_fields TEXT DEFAULT '[]',
      memory_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(shift_id) REFERENCES shifts(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'INFO',
      read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER,
      filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      content_type TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE SET NULL
    );
    ''')
    # Demo-safe machine seed; no issue/task seed data is inserted.
    for name in ['Machine 1','Machine 2','Machine 3','Machine 4','Machine 5','Machine 6','Machine 7']:
        conn.execute('INSERT OR IGNORE INTO machines(name, created_at) VALUES (?, ?)', (name, now()))
    conn.commit(); conn.close()

def rowdict(row):
    return dict(row) if row else None

def list_issues():
    conn = get_conn(); rows = conn.execute('SELECT * FROM issues ORDER BY CASE priority WHEN "CRITICAL" THEN 0 WHEN "HIGH" THEN 1 WHEN "MEDIUM" THEN 2 ELSE 3 END, updated_at DESC').fetchall(); conn.close(); return [rowdict(r) for r in rows]

def get_issue(issue_id):
    conn = get_conn(); row = conn.execute('SELECT * FROM issues WHERE id=?', (issue_id,)).fetchone(); conn.close(); return rowdict(row)

def add_event(issue_id, event_type, message, actor='SHIFTmate'):
    conn = get_conn(); conn.execute('INSERT INTO issue_events(issue_id,event_type,message,actor,created_at) VALUES(?,?,?,?,?)',(issue_id,event_type,message,actor,now())); conn.commit(); conn.close()

def issue_timeline(issue_id):
    conn = get_conn(); rows = conn.execute('SELECT * FROM issue_events WHERE issue_id=? ORDER BY created_at ASC',(issue_id,)).fetchall(); conn.close(); return [rowdict(r) for r in rows]

def create_issue(data):
    t=now(); conn=get_conn(); cur=conn.execute('''INSERT INTO issues(machine,issue,priority,status,maintenance,affected_order,description,recommended_action,assigned_to,reporter_id,shift_id,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',(
        data.get('machine'), data['issue'], data.get('priority','MEDIUM').upper(), data.get('status','REPORTED').upper(), data.get('maintenance','Pending'), data.get('affected_order'), data.get('description',''), data.get('recommended_action',''), data.get('assigned_to'), data.get('reporter_id'), data.get('shift_id'), data.get('source','operator'), t,t))
    iid=cur.lastrowid; conn.execute('INSERT INTO issue_events(issue_id,event_type,message,actor,created_at) VALUES(?,?,?,?,?)',(iid,'REPORTED',data.get('description') or data['issue'],'Operator',t)); conn.commit(); conn.close(); return get_issue(iid)

def update_issue(issue_id, fields, actor='Operator'):
    allowed={'priority','status','maintenance','assigned_to','description','recommended_action','affected_order','machine','issue'}
    clean={k:v for k,v in fields.items() if k in allowed and v is not None}
    if not clean: return get_issue(issue_id)
    clean['updated_at']=now()
    if clean.get('status','').upper() in {'RESOLVED','VERIFIED'}: clean['resolved_at']=now()
    cols=', '.join(f'{k}=?' for k in clean); vals=list(clean.values())+[issue_id]
    conn=get_conn(); conn.execute(f'UPDATE issues SET {cols} WHERE id=?', vals); conn.commit(); conn.close()
    status=clean.get('status');
    if status: add_event(issue_id,status.upper(),f'Status changed to {status}',actor)
    return get_issue(issue_id)

def current_shift(user_id):
    conn=get_conn(); row=conn.execute('SELECT * FROM shifts WHERE user_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',(user_id,)).fetchone(); conn.close(); return rowdict(row)

def start_shift(user_id, notes=''):
    existing=current_shift(user_id)
    if existing: return existing
    conn=get_conn(); cur=conn.execute('INSERT INTO shifts(user_id,started_at,notes) VALUES(?,?,?)',(user_id,now(),notes)); conn.commit(); sid=cur.lastrowid; conn.close(); return current_shift(user_id)

def end_shift(shift_id):
    conn=get_conn(); conn.execute('UPDATE shifts SET ended_at=? WHERE id=?',(now(),shift_id)); conn.commit(); row=conn.execute('SELECT * FROM shifts WHERE id=?',(shift_id,)).fetchone(); conn.close(); return rowdict(row)

def ensure_user(name='Operator', email=None, google_id=None, avatar=None, role='Operator'):
    conn=get_conn()
    row=None
    if google_id: row=conn.execute('SELECT * FROM users WHERE google_id=?',(google_id,)).fetchone()
    if not row and email: row=conn.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
    if row:
        conn.execute('UPDATE users SET name=?,avatar=?,role=? WHERE id=?',(name,avatar or row['avatar'],role,row['id'])); conn.commit(); conn.close(); return rowdict(conn.execute('SELECT * FROM users WHERE id=?',(row['id'],)).fetchone()) if False else rowdict(row)
    cur=conn.execute('INSERT INTO users(google_id,name,email,avatar,role,created_at) VALUES(?,?,?,?,?,?)',(google_id,name,email,avatar,role,now())); conn.commit(); uid=cur.lastrowid; row=conn.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone(); conn.close(); return rowdict(row)

def summary_for_shift(shift_id=None):
    conn=get_conn()
    if shift_id: rows=conn.execute('SELECT * FROM issues WHERE shift_id=? ORDER BY updated_at DESC',(shift_id,)).fetchall()
    else: rows=conn.execute('SELECT * FROM issues ORDER BY updated_at DESC').fetchall()
    conn.close(); return [rowdict(r) for r in rows]

def create_handover(summary, quality_score, missing_fields, shift_id=None, memory_id=None):
    conn=get_conn(); cur=conn.execute('INSERT INTO handovers(shift_id,summary,quality_score,missing_fields,memory_id,created_at) VALUES(?,?,?,?,?,?)',(shift_id,summary,quality_score,json.dumps(missing_fields),memory_id,now())); conn.commit(); row=conn.execute('SELECT * FROM handovers WHERE id=?',(cur.lastrowid,)).fetchone(); conn.close(); d=rowdict(row); d['missing_fields']=json.loads(d['missing_fields'] or '[]'); return d

def latest_handover():
    conn=get_conn(); row=conn.execute('SELECT * FROM handovers ORDER BY created_at DESC LIMIT 1').fetchone(); conn.close();
    if not row: return None
    d=rowdict(row); d['missing_fields']=json.loads(d['missing_fields'] or '[]'); return d

def add_notification(title,message,severity='INFO'):
    conn=get_conn(); conn.execute('INSERT INTO notifications(title,message,severity,created_at) VALUES(?,?,?,?)',(title,message,severity,now())); conn.commit(); conn.close()

def notifications():
    conn=get_conn(); rows=conn.execute('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').fetchall(); conn.close(); return [rowdict(r) for r in rows]

def add_attachment(issue_id,filename,path,content_type):
    conn=get_conn(); cur=conn.execute('INSERT INTO attachments(issue_id,filename,stored_path,content_type,created_at) VALUES(?,?,?,?,?)',(issue_id,filename,path,content_type,now())); conn.commit(); row=conn.execute('SELECT * FROM attachments WHERE id=?',(cur.lastrowid,)).fetchone(); conn.close(); return rowdict(row)
