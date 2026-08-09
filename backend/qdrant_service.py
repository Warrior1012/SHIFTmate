import os
from uuid import uuid4
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

load_dotenv()
QDRANT_URL=os.getenv('QDRANT_URL'); QDRANT_API_KEY=os.getenv('QDRANT_API_KEY')
COLLECTION_NAME='shiftmate_memory'
if not QDRANT_URL: raise ValueError('QDRANT_URL is missing from .env')
if not QDRANT_API_KEY: raise ValueError('QDRANT_API_KEY is missing from .env')

class QdrantMemory:
    def __init__(self):
        print('Initializing Qdrant...')
        self.client=QdrantClient(url=QDRANT_URL,api_key=QDRANT_API_KEY,check_compatibility=False)
        print('Loading embedding model...')
        self.model=SentenceTransformer('all-MiniLM-L6-v2')
        self._ensure_collection()
    def _ensure_collection(self):
        names=[c.name for c in self.client.get_collections().collections]
        if COLLECTION_NAME not in names:
            self.client.create_collection(collection_name=COLLECTION_NAME,vectors_config=VectorParams(size=384,distance=Distance.COSINE))
            print('Qdrant collection created')
        else: print('Qdrant collection ready')
    def store_memory(self,text,metadata=None):
        vector=self.model.encode(text).tolist(); payload={'text':text}; payload.update(metadata or {})
        point=PointStruct(id=str(uuid4()),vector=vector,payload=payload)
        self.client.upsert(collection_name=COLLECTION_NAME,points=[point]); return point.id
    def search_memory(self,query,limit=3):
        vector=self.model.encode(query).tolist(); results=self.client.query_points(collection_name=COLLECTION_NAME,query=vector,limit=limit).points
        return [{'id':r.id,'score':r.score,'text':r.payload.get('text',''),'metadata':r.payload} for r in results]
    def health(self):
        self.client.get_collections(); return True
memory=QdrantMemory()
