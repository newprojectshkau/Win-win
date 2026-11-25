"""Shared demo review API. Python 3.11+, SQLite; no third-party dependencies."""
import re, hashlib, hmac, json, os, secrets, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

SCHEMA = '''
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, name TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(client TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, author TEXT NOT NULL, updated INTEGER NOT NULL, payload TEXT NOT NULL);
'''
IDS = {f'A{i:02}' for i in range(1,23)}
def validate_payload(p):
    if not isinstance(p,dict) or set(p)!={'reviews','general'}: raise ValueError('Only reviews and general are accepted')
    if not isinstance(p['general'],str) or len(p['general'])>12000: raise ValueError('Invalid general comment')
    if not isinstance(p['reviews'],dict) or not set(p['reviews'])<=IDS: raise ValueError('Invalid assumption IDs')
    for v in p['reviews'].values():
        if not isinstance(v,dict) or set(v)!={'status','comment'} or v['status'] not in ['unreviewed','accepted','change'] or not isinstance(v['comment'],str) or len(v['comment'])>4000: raise ValueError('Invalid review')
    return p

def handler(db_path, access_code, origins, ttl=28800, secure=True):
    Path(db_path).parent.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(db_path) as db: db.executescript(SCHEMA)
    def connect():
        db=sqlite3.connect(db_path,timeout=10); db.row_factory=sqlite3.Row; return db
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass  # Never log credentials or submitted comments.
        def reply(self,code,data,cookie=None):
            self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
            origin=self.headers.get('Origin','')
            if origin in origins:
                self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Access-Control-Allow-Credentials','true');self.send_header('Vary','Origin')
            if cookie: self.send_header('Set-Cookie',cookie)
            self.end_headers();self.wfile.write(json.dumps(data,ensure_ascii=False).encode())
        def cookie(self,token,age):
            return f'g3_session={token}; Path=/api; HttpOnly; Max-Age={age}; SameSite={"None; Secure" if secure else "Lax"}'
        def token_hash(self):
            from http.cookies import SimpleCookie
            try:
                c=SimpleCookie(self.headers.get('Cookie','')); token=c['g3_session'].value
            except (KeyError,ValueError): token=''
            return hashlib.sha256(token.encode()).hexdigest()
        def session(self,db):
            return db.execute('SELECT * FROM sessions WHERE token_hash=? AND expires>?',(self.token_hash(),int(time.time()))).fetchone()
        def read_json(self):
            n=int(self.headers.get('Content-Length','0'))
            if not 0<n<=150000: raise ValueError('Invalid body size')
            return json.loads(self.rfile.read(n))
        def do_OPTIONS(self):
            if self.headers.get('Origin') not in origins: return self.reply(403,{'error':'Origin denied'})
            self.send_response(204)
            for k,v in [('Access-Control-Allow-Origin',self.headers['Origin']),('Access-Control-Allow-Credentials','true'),('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS'),('Access-Control-Allow-Headers','Content-Type'),('Vary','Origin')]:self.send_header(k,v)
            self.end_headers()
        def do_GET(self): self.handle_api()
        def do_POST(self): self.handle_api()
        def do_PUT(self): self.handle_api()
        def handle_api(self):
            path=urlparse(self.path).path; now=int(time.time())
            # Reject browser cross-origin reads/writes unless explicitly allowed. Mutations require Origin.
            origin=self.headers.get('Origin')
            if (origin and origin not in origins) or (self.command!='GET' and origin not in origins): return self.reply(403,{'error':'Origin denied'})
            try:
                with connect() as db:
                    if path=='/api/login' and self.command=='POST':
                        p=self.read_json()
                        if not isinstance(p,dict):raise ValueError('Invalid login')
                        name=p.get('name',''); code=p.get('code','')
                        if not isinstance(name,str) or not 1<=len(name.strip())<=80 or not isinstance(code,str) or len(code)>512: return self.reply(400,{'error':'Invalid login fields'})
                        # Persistent limits, keyed by direct peer IP (do not trust forwarded headers).
                        client=self.client_address[0]
                        db.execute('BEGIN IMMEDIATE')
                        old=db.execute('SELECT * FROM attempts WHERE client=?',(client,)).fetchone()
                        if old and old['reset']>now and old['count']>=5: return self.reply(429,{'error':'Too many attempts; retry after 15 minutes'})
                        count=old['count'] if old and old['reset']>now else 0
                        if not hmac.compare_digest(code.encode(),access_code.encode()):
                            db.execute('INSERT OR REPLACE INTO attempts VALUES(?,?,?)',(client,count+1,old['reset'] if old and old['reset']>now else now+900));db.commit()
                            return self.reply(401,{'error':'Invalid demo access code'})
                        db.execute('DELETE FROM attempts WHERE client=?',(client,))
                        db.execute('DELETE FROM sessions WHERE expires<=?',(now,))
                        token=secrets.token_urlsafe(32)
                        db.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),name.strip(),now+ttl));db.commit()
                        return self.reply(200,{'name':name.strip(),'expiresAt':now+ttl},self.cookie(token,ttl))
                    session=self.session(db)
                    if not session:return self.reply(401,{'error':'Login required'},self.cookie('',0))
                    if path=='/api/session' and self.command=='GET':return self.reply(200,{'name':session['name'],'expiresAt':session['expires']})
                    if path=='/api/logout' and self.command=='POST':
                        db.execute('DELETE FROM sessions WHERE token_hash=?',(session['token_hash'],));db.commit()
                        return self.reply(200,{'ok':True},self.cookie('',0))
                    if path=='/api/records' and self.command=='GET':
                        return self.reply(200,{'records':[dict(row) | {'payload':json.loads(row['payload'])} for row in db.execute('SELECT * FROM records ORDER BY updated DESC,id')]})
                    if path=='/api/records' and self.command=='POST':
                        p=validate_payload(self.read_json()); rid=secrets.token_hex(16)
                        db.execute('INSERT INTO records VALUES(?,?,?,?,?)',(rid,1,session['name'],now,json.dumps(p)));db.commit()
                        return self.reply(201,{'id':rid,'revision':1,'author':session['name'],'updated':now,'payload':p})
                    if path.startswith('/api/records/') and self.command=='PUT':
                        rid=path.rsplit('/',1)[-1]; body=self.read_json()
                        if not re.fullmatch('[a-f0-9]{32}',rid):raise ValueError('Invalid record ID')
                        if not isinstance(body,dict) or set(body)!={'revision','payload'} or type(body['revision']) is not int:raise ValueError('Revision required')
                        p=validate_payload(body['payload']);db.execute('BEGIN IMMEDIATE')
                        row=db.execute('SELECT * FROM records WHERE id=?',(rid,)).fetchone()
                        if not row:
                            if body['revision']!=0:return self.reply(404,{'error':'Record not found'})
                            db.execute('INSERT INTO records VALUES(?,?,?,?,?)',(rid,1,session['name'],now,json.dumps(p)));db.commit()
                            return self.reply(201,{'id':rid,'revision':1,'author':session['name'],'updated':now,'payload':p})
                        if row['revision']!=body['revision']:return self.reply(409,{'error':'Conflict; local changes preserved','record':dict(row)|{'payload':json.loads(row['payload'])}})
                        revision=row['revision']+1
                        db.execute('UPDATE records SET revision=?,author=?,updated=?,payload=? WHERE id=?',(revision,session['name'],now,json.dumps(p),rid));db.commit()
                        return self.reply(200,{'id':rid,'revision':revision,'author':session['name'],'updated':now,'payload':p})
                    self.reply(404,{'error':'Not found'})
            except (ValueError,TypeError,json.JSONDecodeError):self.reply(400,{'error':'Invalid request'})
            except sqlite3.Error:self.reply(503,{'error':'Storage unavailable; preserve local changes'})
    return Handler

def main():
    code=os.environ.get('DEMO_ACCESS_CODE','')
    if len(code)<12:raise SystemExit('Set DEMO_ACCESS_CODE (at least 12 characters) through host secret settings')
    origins={v.strip() for v in os.environ.get('ALLOWED_ORIGINS','').split(',') if v.strip()}
    if not origins:raise SystemExit('Set ALLOWED_ORIGINS to the exact frontend origin')
    server=ThreadingHTTPServer(('0.0.0.0',int(os.environ.get('PORT','8080'))),handler(os.environ.get('DATABASE_PATH','/data/reviews.sqlite3'),code,origins,secure=os.environ.get('COOKIE_SECURE','true')!='false'))
    server.serve_forever()
if __name__=='__main__':main()
