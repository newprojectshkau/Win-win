import http.client, importlib.util, json, sqlite3, tempfile, threading, unittest
from pathlib import Path
from http.server import ThreadingHTTPServer
spec=importlib.util.spec_from_file_location('review_server',Path(__file__).with_name('server.py'));mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class APITest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.db=str(Path(self.tmp.name)/'reviews.db');self.start()
 def start(self):
  self.server=ThreadingHTTPServer(('127.0.0.1',0),mod.handler(self.db,'test-only-access-code',{'http://localhost:8010'},secure=False));self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
 def tearDown(self):self.server.shutdown();self.server.server_close();self.tmp.cleanup()
 def req(self,path,method='GET',data=None,cookie=None,origin='http://localhost:8010'):
  c=http.client.HTTPConnection('127.0.0.1',self.server.server_port);headers={'Origin':origin}
  if cookie:headers['Cookie']=cookie
  if data is not None:headers['Content-Type']='application/json'
  c.request(method,path,json.dumps(data) if data is not None else None,headers);r=c.getresponse();value=json.loads(r.read());result=(r.status,value,r.getheader('Set-Cookie'));c.close();return result
 def login(self,name='Same Name'):
  s,p,c=self.req('/api/login','POST',{'name':name,'code':'test-only-access-code'});self.assertEqual(s,200);self.assertIn('HttpOnly',c);return c.split(';')[0]
 def test_auth_expiry_logout_and_origin(self):
  self.assertEqual(self.req('/api/records')[0],401)
  self.assertEqual(self.req('/api/records','POST',{})[0],401)
  self.assertEqual(self.req('/api/login','POST',{'name':'X','code':'wrong'})[0],401)
  cookie=self.login();self.assertEqual(self.req('/api/records',cookie=cookie)[0],200)
  self.assertEqual(self.req('/api/records','POST',{},cookie,origin='https://evil.test')[0],403)
  with sqlite3.connect(self.db) as db:db.execute('UPDATE sessions SET expires=0')
  self.assertEqual(self.req('/api/records',cookie=cookie)[0],401)
  cookie=self.login();self.assertEqual(self.req('/api/logout','POST',{},cookie)[0],200);self.assertEqual(self.req('/api/records',cookie=cookie)[0],401)
 def test_persistence_two_browsers_conflict_and_same_name(self):
  a=self.login();b=self.login();payload={'reviews':{'A01':{'status':'accepted','comment':'跨瀏覽器留言'}},'general':'團隊'}
  status,first,_=self.req('/api/records','POST',payload,a);self.assertEqual(status,201)
  _,second,_=self.req('/api/records','POST',payload,b);self.assertNotEqual(first['id'],second['id'])
  rows=self.req('/api/records',cookie=b)[1]['records'];self.assertEqual(len(rows),2);self.assertEqual(rows[0]['payload']['general'],'團隊')
  path='/api/records/'+first['id'];data={'revision':1,'payload':payload}
  self.assertEqual(self.req(path,'PUT',data,a)[0],200);self.assertEqual(self.req(path,'PUT',data,b)[0],409)
  self.server.shutdown();self.server.server_close();self.start()
  self.assertEqual(len(self.req('/api/records',cookie=b)[1]['records']),2)
 def test_stable_create_id_prevents_duplicate_on_retry(self):
  cookie=self.login();data={'revision':0,'payload':{'reviews':{},'general':'retry'}};path='/api/records/'+'a'*32
  self.assertEqual(self.req(path,'PUT',data,cookie)[0],201)
  self.assertEqual(self.req(path,'PUT',data,cookie)[0],409)
  self.assertEqual(len(self.req('/api/records',cookie=cookie)[1]['records']),1)
 def test_rate_limits_persist_across_restart(self):
  for _ in range(5):self.assertEqual(self.req('/api/login','POST',{'name':'X','code':'bad'})[0],401)
  self.server.shutdown();self.server.server_close();self.start()
  self.assertEqual(self.req('/api/login','POST',{'name':'X','code':'test-only-access-code'})[0],429)
 def test_rejects_non_review_data(self):
  c=self.login()
  for payload in [{'reviews':{},'general':'ok','runs':[]},{'reviews':{'A99':{}},'general':'x'},{'reviews':{},'general':123}]:self.assertEqual(self.req('/api/records','POST',payload,c)[0],400)
if __name__=='__main__':unittest.main()
