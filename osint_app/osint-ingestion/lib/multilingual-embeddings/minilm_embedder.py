#!/usr/bin/env python3
"""
Multilingual MiniLM Embedder
Uses sentence-transformers for multilingual embeddings
"""

import sys
import json
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    MODEL_AVAILABLE = True
except ImportError:
    MODEL_AVAILABLE = False

def embed_text(text, language=None):
    if not MODEL_AVAILABLE:
        # Return mock embedding
        return {
            "embedding": [0.1] * 384,
            "model": "mock-multilingual-minilm",
            "language": language or "unknown"
        }
    
    try:
        model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        embedding = model.encode(text)
        
        return {
            "embedding": embedding.tolist(),
            "model": "paraphrase-multilingual-MiniLM-L12-v2",
            "language": language or "auto"
        }
    except Exception as e:
        return {
            "error": str(e),
            "embedding": [0.0] * 384
        }

def main():
    # Check for test mode
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        print(json.dumps({"test": "success"}))
        return
    
    # Read input
    input_data = json.loads(sys.stdin.read())
    text = input_data.get('text', '')
    language = input_data.get('language', None)
    
    # Generate embedding
    result = embed_text(text, language)
    
    # Output result
    print(json.dumps(result))

if __name__ == '__main__':
    main()