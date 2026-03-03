
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "xx",
  authDomain: "xx",
  projectId: "xx",
  storageBucket: "xx",
  messagingSenderId: "xx",
  appId: "xx",
  measurementId: "xx"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
