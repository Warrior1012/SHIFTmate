import os
from pathlib import Path
import requests
from dotenv import load_dotenv
load_dotenv(); RIME_API_KEY=os.getenv('RIME_API_KEY')
if not RIME_API_KEY: raise ValueError('RIME_API_KEY is missing from .env')
class RimeService:
    def __init__(self):
        self.url='https://users.rime.ai/v1/rime-tts'; self.headers={'Authorization':f'Bearer {RIME_API_KEY}','Content-Type':'application/json','Accept':'audio/wav'}; self.speaker='astra'; self.model='arcana'; print('Rime ready')
    def speak(self,text,output_path,language='en'):
        lang={'en':'eng','hi':'hin','hinglish':'hin'}.get((language or 'en').lower().strip(),'eng')
        response=requests.post(self.url,headers=self.headers,json={'text':text,'speaker':self.speaker,'modelId':self.model,'lang':lang},timeout=30)
        if response.status_code!=200: raise RuntimeError(f'Rime request failed: {response.status_code} - {response.text}')
        path=Path(output_path); path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(response.content); return str(path)
rime=RimeService()
