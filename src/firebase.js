import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            "AIzaSyDItlxV17eET_8QFABsevCsveoamjvAqkY",
  authDomain:        "obra-posto-medico.firebaseapp.com",
  databaseURL:       "https://obra-posto-medico-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "obra-posto-medico",
  storageBucket:     "obra-posto-medico.firebasestorage.app",
  messagingSenderId: "195200750230",
  appId:             "1:195200750230:web:bcb77e831acab3ebb228b7",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);