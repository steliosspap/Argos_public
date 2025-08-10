#!/usr/bin/env python3
"""
HDBSCAN clustering script for event deduplication
"""

import sys
import json
import argparse
import numpy as np
import hdbscan
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

def load_data(data_file):
    """Load clustering data from JSON file"""
    with open(data_file, 'r') as f:
        data = json.load(f)
    return data

def prepare_features(data, use_pca=True, n_components=50):
    """Prepare feature matrix for clustering"""
    vectors = np.array(data['vectors'])
    
    # If we have additional features, concatenate them
    if 'features' in data and len(data['features']) > 0:
        features = np.array(data['features'])
        # Scale features before concatenation
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # Combine embeddings with scaled features
        # Weight embeddings more heavily
        combined = np.hstack([vectors * 0.8, features_scaled * 0.2])
    else:
        combined = vectors
    
    # Apply PCA if requested and we have enough samples
    if use_pca and combined.shape[0] > n_components:
        pca = PCA(n_components=n_components, random_state=42)
        combined = pca.fit_transform(combined)
    
    return combined

def cluster_events(features, min_cluster_size, min_samples, metric, cluster_selection_epsilon):
    """Perform HDBSCAN clustering"""
    
    # Handle edge cases
    if features.shape[0] < min_cluster_size:
        # Not enough samples to form any cluster
        return [-1] * features.shape[0]
    
    # Initialize HDBSCAN
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric=metric,
        cluster_selection_epsilon=cluster_selection_epsilon,
        cluster_selection_method='eom',  # Excess of Mass
        prediction_data=True,
        core_dist_n_jobs=-1
    )
    
    # Fit and predict
    cluster_labels = clusterer.fit_predict(features)
    
    return cluster_labels.tolist()

def process_event_data(event_data):
    """Process event data from API format"""
    event_ids = []
    vectors = []
    
    for event in event_data:
        event_ids.append(event['id'])
        # Handle embedding format - could be string or list
        if isinstance(event['embedding'], str):
            # Parse PostgreSQL array format
            embedding_str = event['embedding'].strip('[]')
            embedding = [float(x) for x in embedding_str.split(',')]
        else:
            embedding = event['embedding']
        vectors.append(embedding)
    
    return event_ids, np.array(vectors)

def format_cluster_results(event_ids, labels):
    """Format clustering results for API response"""
    clusters = {}
    clustered_count = 0
    noise_count = 0
    
    for event_id, label in zip(event_ids, labels):
        if label == -1:
            noise_count += 1
        else:
            clustered_count += 1
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(event_id)
    
    # Convert to list format
    cluster_list = []
    for cluster_id, event_ids in clusters.items():
        cluster_list.append({
            'cluster_id': int(cluster_id),
            'event_ids': event_ids,
            'size': len(event_ids)
        })
    
    return {
        'clusters': cluster_list,
        'clustered_count': clustered_count,
        'noise_count': noise_count
    }

def main():
    parser = argparse.ArgumentParser(description='HDBSCAN clustering for events')
    parser.add_argument('--data', type=str, required=True,
                        help='JSON string of event data or path to file')
    parser.add_argument('--min-cluster-size', type=int, default=2,
                        help='Minimum cluster size')
    parser.add_argument('--min-samples', type=int, default=1,
                        help='Minimum samples for core points')
    parser.add_argument('--metric', type=str, default='euclidean',
                        help='Distance metric')
    parser.add_argument('--cluster-selection-epsilon', type=float, default=0.3,
                        help='Cluster selection epsilon')
    parser.add_argument('--use-pca', action='store_true',
                        help='Apply PCA before clustering')
    parser.add_argument('--time-window', type=str, default='24 hours',
                        help='Time window for clustering (for database queries)')
    
    args = parser.parse_args()
    
    try:
        # Load data - either from file or JSON string
        if args.data.startswith('['):
            # Direct JSON data
            event_data = json.loads(args.data)
        else:
            # File path
            with open(args.data, 'r') as f:
                event_data = json.load(f)
        
        # Process event data
        event_ids, vectors = process_event_data(event_data)
        
        # Prepare features
        data = {'vectors': vectors}
        features = prepare_features(data, use_pca=args.use_pca)
        
        # Perform clustering
        labels = cluster_events(
            features,
            args.min_cluster_size,
            args.min_samples,
            args.metric,
            args.cluster_selection_epsilon
        )
        
        # Format results
        results = format_cluster_results(event_ids, labels)
        
        # Output results as JSON
        print(json.dumps(results))
        
    except Exception as e:
        print(f"Clustering error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()