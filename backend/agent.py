from qdrant_service import memory
from gemini_service import gemini
from rime_service import rime
from pathlib import Path
from uuid import uuid4
class ShiftMateAgent:
    def save_handover(self,handover_text,metadata=None):
        mid=memory.store_memory(handover_text,metadata or {'source':'shift_handover'}); return {'success':True,'memory_id':mid}
    def ask(self,user_query,language='en'):
        memories=memory.search_memory(user_query,limit=5); answer=gemini.generate_response(user_query,memories,language=language); return {'answer':answer,'memories':memories}
    def ask_with_voice(self,user_query,audio_dir,language='en'):
        result=self.ask(user_query,language=language); filename=f'response_{uuid4().hex}.wav'; path=Path(audio_dir)/filename; rime.speak(result['answer'],str(path),language=language); result['audio_file']=str(path); result['audio_filename']=filename; return result
    def extract_incident(self,text):
        try: return gemini.extract_incident(text)
        except Exception:
            lower=text.lower(); priority='CRITICAL' if any(x in lower for x in ['critical','danger','shutdown']) else 'HIGH' if any(x in lower for x in ['abnormal','urgent','vibration','overheat','failure']) else 'MEDIUM'
            return {'machine':next((f'Machine {n}' for n in range(1,21) if f'machine {n}' in lower),None),'issue':text[:100],'priority':priority,'affected_order':None,'description':text,'recommended_action':'Inspect the affected equipment and follow the maintenance procedure.','should_create_issue':True}
agent=ShiftMateAgent()
