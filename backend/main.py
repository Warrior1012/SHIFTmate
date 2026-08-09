import os, json, uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from agent import agent
from qdrant_service import memory
import db

load_dotenv(); db.init_db()
BASE=Path(__file__).resolve().parent; AUDIO=BASE/'audio'; UPLOADS=BASE/'uploads'; AUDIO.mkdir(exist_ok=True); UPLOADS.mkdir(exist_ok=True)
origins=[x.strip() for x in os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()]
app=FastAPI(title='SHIFTmate API',description='Voice-first shift continuity assistant',version='2.0.0')
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=['*'],allow_headers=['*'])
app.mount('/audio',StaticFiles(directory=str(AUDIO)),name='audio'); app.mount('/uploads',StaticFiles(directory=str(UPLOADS)),name='uploads')

class AskRequest(BaseModel): query:str=Field(min_length=1,max_length=4000); language:str='en'
class HandoverRequest(BaseModel): text:str; machine:str|None=None; issue:str|None=None; status:str='unresolved'; priority:str='medium'; shift_id:int|None=None
class DevLogin(BaseModel): name:str='Operator'; email:str|None=None; role:str='Operator'
class IssueCreate(BaseModel): machine:str|None=None; issue:str; priority:str='MEDIUM'; status:str='REPORTED'; maintenance:str='Pending'; affected_order:str|None=None; description:str=''; recommended_action:str=''; assigned_to:str|None=None; reporter_id:int|None=None; shift_id:int|None=None; source:str='operator'
class IssueUpdate(BaseModel): machine:str|None=None; issue:str|None=None; priority:str|None=None; status:str|None=None; maintenance:str|None=None; affected_order:str|None=None; description:str|None=None; recommended_action:str|None=None; assigned_to:str|None=None
class ShiftStart(BaseModel): user_id:int; notes:str=''
class HandoverGenerate(BaseModel): shift_id:int|None=None

@app.get('/')
def root(): return {'status':'online','service':'SHIFTmate','version':'2.0.0'}
@app.get('/health')
def health():
    services={'api':'ready','qdrant':'offline','gemini':'configured' if os.getenv('GEMINI_API_KEY') else 'offline','rime':'configured' if os.getenv('RIME_API_KEY') else 'offline'}
    try: memory.health(); services['qdrant']='ready'
    except Exception: services['qdrant']='offline'
    overall='healthy' if services['qdrant']=='ready' and services['gemini']=='configured' and services['rime']=='configured' else 'degraded'
    return {'status':overall,'services':services}

@app.post('/auth/dev')
def auth_dev(req:DevLogin):
    user=db.ensure_user(req.name,req.email,None,None,req.role); shift=db.start_shift(user['id']); return {'success':True,'user':user,'shift':shift}
@app.post('/auth/google')
def auth_google(token:str=Form(...)):
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        client_id=os.getenv('GOOGLE_CLIENT_ID')
        info=id_token.verify_oauth2_token(token,google_requests.Request(),client_id if client_id else None)
        user=db.ensure_user(info.get('name') or info.get('email','Operator'),info.get('email'),info.get('sub'),info.get('picture'),'Operator'); shift=db.start_shift(user['id']); return {'success':True,'user':user,'shift':shift}
    except Exception as e: raise HTTPException(401,f'Google authentication failed: {e}')

@app.post('/ask')
def ask(req:AskRequest):
    language=req.language.lower().strip() if req.language else 'en'
    if language not in {'en','hi','hinglish'}: language='en'
    result=agent.ask(req.query,language); return {'success':True,'query':req.query,'language':language,'answer':result['answer'],'memories':result['memories']}
@app.post('/ask/voice')
def ask_voice(req:AskRequest):
    language=req.language.lower().strip() if req.language else 'en'
    if language not in {'en','hi','hinglish'}: language='en'
    result=agent.ask_with_voice(req.query,AUDIO,language); return {'success':True,'query':req.query,'language':language,'answer':result['answer'],'audio_url':f'/audio/{result["audio_filename"]}','memories':result['memories']}

@app.post('/issues')
def create_issue(req:IssueCreate):
    issue=db.create_issue(req.model_dump());
    if issue['priority'] in {'HIGH','CRITICAL'}: db.add_notification(f'{issue["priority"]} priority issue',f'{issue.get("machine") or "Equipment"}: {issue["issue"]}',issue['priority'])
    return {'success':True,'issue':issue}
@app.get('/issues')
def issues(): return {'success':True,'issues':db.list_issues()}
@app.get('/issues/{issue_id}')
def issue(issue_id:int):
    item=db.get_issue(issue_id)
    if not item: raise HTTPException(404,'Issue not found')
    return {'success':True,'issue':item,'timeline':db.issue_timeline(issue_id)}
@app.patch('/issues/{issue_id}')
def update_issue(issue_id:int,req:IssueUpdate):
    if not db.get_issue(issue_id): raise HTTPException(404,'Issue not found')
    item=db.update_issue(issue_id,req.model_dump(exclude_none=True)); return {'success':True,'issue':item,'timeline':db.issue_timeline(issue_id)}
@app.post('/issues/{issue_id}/assign')
def assign_issue(issue_id:int,assignee:str=Form(...)):
    item=db.update_issue(issue_id,{'assigned_to':assignee,'status':'ACKNOWLEDGED'},'Supervisor'); return {'success':True,'issue':item}
@app.post('/issues/{issue_id}/resolve')
def resolve_issue(issue_id:int,resolution:str=Form('Issue resolved')):
    item=db.update_issue(issue_id,{'status':'RESOLVED','maintenance':'Completed','description':(db.get_issue(issue_id) or {}).get('description','')+' Resolution: '+resolution},'Operator'); return {'success':True,'issue':item}

@app.post('/issues/extract')
def extract_issue(req:AskRequest):
    data=agent.extract_incident(req.query); issue=None
    if data.get('should_create_issue'): issue=db.create_issue({'machine':data.get('machine'),'issue':data.get('issue') or req.query,'priority':data.get('priority','MEDIUM'),'affected_order':data.get('affected_order'),'description':data.get('description') or req.query,'recommended_action':data.get('recommended_action'),'source':'voice_or_text'})
    return {'success':True,'extraction':data,'issue':issue}

@app.post('/memory/search')
def memory_search(req:AskRequest): return {'success':True,'memories':memory.search_memory(req.query,limit=10)}

@app.post('/handover')
def save_handover(req:HandoverRequest):
    result=agent.save_handover(req.text,{'source':'shift_handover','machine':req.machine,'issue':req.issue,'status':req.status,'priority':req.priority}); return {'success':True,'message':'Handover saved successfully','memory_id':result['memory_id']}
@app.post('/handover/generate')
def generate_handover(req:HandoverGenerate):
    issues=db.summary_for_shift(req.shift_id); pending=[i for i in issues if i['status'] not in {'RESOLVED','VERIFIED'}]; high=[i for i in pending if i['priority'] in {'HIGH','CRITICAL'}]
    lines=['SHIFT HANDOVER','',f'Issues reported: {len(issues)}',f'Unresolved: {len(pending)}',f'High priority: {len(high)}','']
    for i in pending[:10]: lines.append(f'- {i.get("machine") or "Equipment"}: {i["issue"]} [{i["priority"]}] — {i.get("recommended_action") or "Follow maintenance procedure."}')
    summary='\n'.join(lines); missing=[]
    if any(not i.get('machine') for i in pending): missing.append('machine identifier')
    if any(not i.get('recommended_action') for i in pending): missing.append('recommended action')
    score=max(0,100-len(missing)*15-(20 if not pending else 0)); mid=agent.save_handover(summary,{'source':'generated_handover','shift_id':req.shift_id,'status':'unresolved','priority':'high' if high else 'medium'})['memory_id']; hand=db.create_handover(summary,score,missing,req.shift_id,mid); return {'success':True,'handover':hand,'issues':issues}
@app.get('/handover/latest')
def handover_latest(): return {'success':True,'handover':db.latest_handover()}

@app.post('/shifts/start')
def shift_start(req:ShiftStart): return {'success':True,'shift':db.start_shift(req.user_id,req.notes)}
@app.post('/shifts/{shift_id}/end')
def shift_end(shift_id:int): return {'success':True,'shift':db.end_shift(shift_id)}
@app.get('/shifts/current/{user_id}')
def shift_current(user_id:int): return {'success':True,'shift':db.current_shift(user_id)}

@app.get('/machines')
def machines():
    conn=db.get_conn(); rows=conn.execute('SELECT * FROM machines ORDER BY name').fetchall(); conn.close(); return {'success':True,'machines':[dict(r) for r in rows]}
@app.get('/notifications')
def get_notifications(): return {'success':True,'notifications':db.notifications()}
@app.post('/attachments')
async def upload_attachment(file:UploadFile=File(...),issue_id:int|None=Form(None)):
    suffix=Path(file.filename or '').suffix[:10]; safe=f'{uuid.uuid4().hex}{suffix}'; path=UPLOADS/safe; path.write_bytes(await file.read()); att=db.add_attachment(issue_id,file.filename or safe,str(path),file.content_type); return {'success':True,'attachment':{**att,'url':f'/uploads/{safe}'}}
