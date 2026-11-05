"""
auth/firebase_config.py - Loads Firebase Web App configuration from .env
"""

import os
from typing import Dict
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def get_firebase_web_config() -> Dict[str, str]:
    """Returns the Firebase Web Client configuration dictionary for frontend SDK"""
    return {
        "apiKey": os.getenv("FIREBASE_API_KEY", ""),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN", "localgpt-pro.firebaseapp.com"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID", "localgpt-pro"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET", "localgpt-pro.appspot.com"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID", ""),
        "appId": os.getenv("FIREBASE_APP_ID", "")
    }

def get_credentials_path() -> str:
    """Returns the path to the serviceAccountKey.json file"""
    return os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

