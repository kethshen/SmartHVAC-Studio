import firebase_admin
from firebase_admin import credentials, firestore, storage
import os
import datetime

class FirebaseConnector:
    def __init__(self, key_path="serviceAccountKey.json"):
        """Initializes the connection using the service account key."""
        if not os.path.exists(key_path):
            raise FileNotFoundError(f"Missing {key_path}. Please upload it to Colab.")

        # Avoid re-initializing if already running in notebook
        if not firebase_admin._apps:
            cred = credentials.Certificate(key_path)
            # You must replace 'YOUR-PROJECT-ID.appspot.com' with your actual bucket name.
            # I will try to infer it from the project ID in the cert, or default to standard pattern.
            
            # Correct Bucket Name from firebaseConfig.js
            bucket_name = "smarthvac-studio-b84c4.firebasestorage.app"
            
            print(f"[Firebase] Initializing with bucket: {bucket_name}")
            
            firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name
            })
        
        self.db = firestore.client()
        self.bucket = storage.bucket() # Uses default bucket
        print(f"[Firebase] Connected to project: {self.db.project}")

    def get_next_queued_job(self):
        """Fetches the oldest 'queued' job."""
        jobs_ref = self.db.collection("jobs")
        # Order by creation time to process FIFO
        # Query for 'queued' AND 'test_connection'
        # Note: 'in' queries support up to 10 values.
        query = jobs_ref.where("status", "in", ["queued", "test_connection"]).order_by("createdAt").limit(1)
        results = list(query.stream())
        
        if results:
            return results[0]  # Return the DocumentSnapshot
        return None

    def update_status(self, job_id, status, error_msg=None, result_path=None):
        """Updates job status and optional fields."""
        doc_ref = self.db.collection("jobs").document(job_id)
        
        update_data = {
            "status": status,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }
        
        if error_msg:
            update_data["errorMessage"] = error_msg
        
        if result_path:
            update_data["resultPath"] = result_path
            
        doc_ref.update(update_data)
        print(f"[Job {job_id}] Status updated to: {status}")

    def upload_file(self, job_id, local_path, remote_folder="results"):
        """Uploads a local file to Firebase Storage."""
        if not os.path.exists(local_path):
            print(f"[Error] File not found: {local_path}")
            return None
            
        filename = os.path.basename(local_path)
        blob_path = f"{remote_folder}/{job_id}/{filename}"
        blob = self.bucket.blob(blob_path)
        
        # Simple MIME type detection based on extension
        content_type = "application/octet-stream"
        if filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".html"):
            content_type = "text/html"
        
        blob.upload_from_filename(local_path, content_type=content_type)
        print(f"[Storage] Uploaded {filename} to {blob_path}")
        
        # Make it publicly accessible for simple viewing (optional, or use signed URLs)
        # For now, we return the path which the frontend uses via SDK
        return blob_path

    def upload_string_as_file(self, job_id, content, filename, remote_folder="idf"):
        """Uploads a string (like IDF content) as a file directly."""
        blob_path = f"{remote_folder}/{job_id}/{filename}"
        blob = self.bucket.blob(blob_path)
        blob.upload_from_string(content, content_type="text/plain")
        print(f"[Storage] Uploaded string content to {blob_path}")
        return blob_path
