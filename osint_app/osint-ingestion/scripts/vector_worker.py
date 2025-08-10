#!/usr/bin/env python3
"""
Vector Worker
Processes embedding generation tasks from a queue
"""

import os
import sys
import json
import time
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import redis
from sentence_transformers import SentenceTransformer
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VectorWorker:
    def __init__(self):
        # Database connection
        self.db_url = os.environ.get('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        # Redis connection
        self.redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
        self.redis_client = redis.from_url(self.redis_url)
        
        # Load model
        logger.info("Loading sentence transformer model...")
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        self.embedding_dim = 384  # MiniLM-L6 dimension
        logger.info("Model loaded successfully")
        
        # Queue names
        self.task_queue = 'embedding_tasks'
        self.result_queue = 'embedding_results'
        
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def generate_embedding(self, text):
        """Generate embedding for text"""
        if not text:
            return np.zeros(768).tolist()  # Return zero vector for empty text
        
        # Generate embedding
        embedding = self.model.encode(text, convert_to_numpy=True)
        
        # Pad to 768 dimensions (pgvector expects this)
        if len(embedding) < 768:
            padded = np.zeros(768)
            padded[:len(embedding)] = embedding
            embedding = padded
        
        return embedding.tolist()
    
    def process_event_embedding(self, event_id):
        """Process embedding for a single event"""
        try:
            conn = self.get_db_connection()
            cur = conn.cursor()
            
            # Fetch event data
            cur.execute("""
                SELECT id, enhanced_headline, summary, primary_actors, 
                       location_name, conflict_type
                FROM events
                WHERE id = %s
            """, (event_id,))
            
            event = cur.fetchone()
            if not event:
                logger.warning(f"Event {event_id} not found")
                return False
            
            # Combine text fields for embedding
            text_parts = [
                event.get('enhanced_headline', ''),
                event.get('summary', ''),
                ' '.join(event.get('primary_actors', [])) if event.get('primary_actors') else '',
                event.get('location_name', ''),
                event.get('conflict_type', '')
            ]
            combined_text = ' | '.join(filter(None, text_parts))
            
            # Generate embedding
            embedding = self.generate_embedding(combined_text)
            
            # Update database
            cur.execute("""
                UPDATE events
                SET embedding = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (embedding, event_id))
            
            conn.commit()
            cur.close()
            conn.close()
            
            logger.info(f"Generated embedding for event {event_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing event {event_id}: {e}")
            if 'conn' in locals():
                conn.rollback()
                conn.close()
            return False
    
    def process_batch_embeddings(self, event_ids):
        """Process embeddings for multiple events"""
        results = []
        for event_id in event_ids:
            success = self.process_event_embedding(event_id)
            results.append({'event_id': event_id, 'success': success})
        return results
    
    def find_events_without_embeddings(self, limit=100):
        """Find events that need embeddings"""
        try:
            conn = self.get_db_connection()
            cur = conn.cursor()
            
            cur.execute("""
                SELECT id
                FROM events
                WHERE embedding IS NULL
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            
            event_ids = [row['id'] for row in cur.fetchall()]
            
            cur.close()
            conn.close()
            
            return event_ids
            
        except Exception as e:
            logger.error(f"Error finding events without embeddings: {e}")
            return []
    
    def run_continuous(self):
        """Run continuous processing loop"""
        logger.info("Starting vector worker...")
        
        while True:
            try:
                # Check for tasks in Redis queue
                task = self.redis_client.lpop(self.task_queue)
                
                if task:
                    task_data = json.loads(task)
                    task_type = task_data.get('type')
                    
                    if task_type == 'single_event':
                        event_id = task_data.get('event_id')
                        success = self.process_event_embedding(event_id)
                        
                        # Store result
                        result = {
                            'task_id': task_data.get('task_id'),
                            'event_id': event_id,
                            'success': success,
                            'timestamp': time.time()
                        }
                        self.redis_client.rpush(
                            self.result_queue,
                            json.dumps(result)
                        )
                    
                    elif task_type == 'batch':
                        event_ids = task_data.get('event_ids', [])
                        results = self.process_batch_embeddings(event_ids)
                        
                        # Store results
                        result = {
                            'task_id': task_data.get('task_id'),
                            'results': results,
                            'timestamp': time.time()
                        }
                        self.redis_client.rpush(
                            self.result_queue,
                            json.dumps(result)
                        )
                
                else:
                    # No tasks in queue, check for events without embeddings
                    event_ids = self.find_events_without_embeddings(50)
                    
                    if event_ids:
                        logger.info(f"Found {len(event_ids)} events without embeddings")
                        self.process_batch_embeddings(event_ids)
                    else:
                        # No work to do, sleep
                        time.sleep(10)
                        
            except KeyboardInterrupt:
                logger.info("Shutting down vector worker...")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(5)
    
    def run_once(self, limit=100):
        """Run once to process events without embeddings"""
        event_ids = self.find_events_without_embeddings(limit)
        
        if not event_ids:
            logger.info("No events found without embeddings")
            return
        
        logger.info(f"Processing {len(event_ids)} events...")
        results = self.process_batch_embeddings(event_ids)
        
        success_count = sum(1 for r in results if r['success'])
        logger.info(f"Completed: {success_count}/{len(results)} successful")

def main():
    """Main entry point"""
    worker = VectorWorker()
    
    # Check command line arguments
    if len(sys.argv) > 1 and sys.argv[1] == 'once':
        # Run once mode
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100
        worker.run_once(limit)
    else:
        # Continuous mode
        worker.run_continuous()

if __name__ == '__main__':
    main()