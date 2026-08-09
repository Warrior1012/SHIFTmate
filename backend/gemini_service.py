import os,json,re
from dotenv import load_dotenv
from google import genai
load_dotenv(); GEMINI_API_KEY=os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY: raise ValueError('GEMINI_API_KEY is missing from .env')
class GeminiService:
    def __init__(self): self.client=genai.Client(api_key=GEMINI_API_KEY); self.model='gemini-2.5-flash'; print('Gemini ready')
    def generate_response(self,user_query,memories,language='en'):
        language=(language or 'en').lower().strip()
        if language=='hi': instruction='Answer in natural Hindi using Devanagari script. Keep machine names, order numbers and necessary technical terms in English where natural.'
        elif language=='hinglish': instruction='Answer in natural WhatsApp-style Hinglish using ONLY Roman script. Mix Hindi and English naturally. Do not use Devanagari. Keep machine names, order numbers and technical terms clear and natural.'
        else: instruction='Answer in concise, natural English.'
        memory_text='\n'.join(m.get('text','') for m in memories)
        prompt=f'''You are SHIFTmate, a voice-first shift continuity assistant.
Worker: {user_query}
Relevant operational memory:
{memory_text}

Language requirement: {instruction}

Rules: be concise, natural and grounded. Never invent facts. If memory does not answer the question, explicitly say the information is unavailable. Speak directly to a worker.'''
        return self.client.models.generate_content(model=self.model,contents=prompt).text or 'The requested information is unavailable.'
    def extract_incident(self,text):
        prompt=f'''Extract a manufacturing operational incident from this operator report. Return ONLY valid JSON with keys machine, issue, priority, affected_order, description, recommended_action, should_create_issue. Use null for unknown. priority must be LOW, MEDIUM, HIGH or CRITICAL. should_create_issue is boolean. Do not invent facts. Report: {text}'''
        raw=self.client.models.generate_content(model=self.model,contents=prompt).text.strip(); raw=re.sub(r'^```(?:json)?\s*|\s*```$','',raw,flags=re.I).strip(); return json.loads(raw)
gemini=GeminiService()
