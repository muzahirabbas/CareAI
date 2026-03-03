import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Bell, CalendarClock, ChevronRight, Download, Edit2, LogOut, Moon, Pill, Plus, Settings, Sparkles, Sun, Unplug, Upload, User, X, FileText, UserPlus, Users, Loader2, FileUp, CheckCircle2, MapPin } from 'lucide-react';
import { extractTextFromFile } from '../utils/ocr';

export function CaregiverDashboard({ caregiverId }: { caregiverId: string }) {
  const [activeTab, setActiveTab] = useState<'patients' | 'vitals' | 'meds' | 'appointments'>('patients');
  const [patients, setPatients] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [meds, setMeds] = useState<any[]>([]);

  const [selectedPatient, setSelectedPatient] = useState('');

  // Patient Creation
  const [pUser, setPUser] = useState('');
  const [pPass, setPPass] = useState('');
  const [pAge, setPAge] = useState('');
  const [pWeight, setPWeight] = useState('');
  const [pHeight, setPHeight] = useState('');
  const [pGender, setPGender] = useState('');
  const [pBloodType, setPBloodType] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pFile, setPFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Edit Patient State
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [editPUser, setEditPUser] = useState('');
  const [editPPass, setEditPPass] = useState('');
  const [editPAge, setEditPAge] = useState('');
  const [editPWeight, setEditPWeight] = useState('');
  const [editPHeight, setEditPHeight] = useState('');
  const [editPGender, setEditPGender] = useState('');
  const [editPBloodType, setEditPBloodType] = useState('');
  const [editPNotes, setEditPNotes] = useState('');
  const [editIsUploading, setEditIsUploading] = useState(false);
  const [editPFile, setEditPFile] = useState<File | null>(null);

  // Link Existing Patient
  const [linkRefId, setLinkRefId] = useState('');

  // Caregiver Profile Info
  const [cgProfile, setCgProfile] = useState<any>(null);

  // Vitals tracking
  const [newVitalDef, setNewVitalDef] = useState('');
  const [entryVital, setEntryVital] = useState('');
  const [entryValue, setEntryValue] = useState('');
  const [activeVitalTab, setActiveVitalTab] = useState('');

  // OCR Vitals Extraction State
  const [ocrStatus, setOcrStatus] = useState<'' | 'extracting' | 'analyzing'>('');
  const [parsedVitalsList, setParsedVitalsList] = useState<{ name: string, value: number }[] | null>(null);
  const [ocrError, setOcrError] = useState('');

  const [aiReport, setAiReport] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiReportsHistory, setAiReportsHistory] = useState<any[]>([]);

  // Medications
  const [mName, setMName] = useState('');
  const [mDose, setMDose] = useState('');
  const [mTimes, setMTimes] = useState<string[]>(['']);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);

  // Appointments
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appName, setAppName] = useState('');
  const [appDate, setAppDate] = useState('');
  const [appTime, setAppTime] = useState('');
  const [appLocation, setAppLocation] = useState('');
  const [appNotes, setAppNotes] = useState('');
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  const addTimeSlot = () => setMTimes([...mTimes, '']);
  const updateTimeSlot = (idx: number, val: string) => {
    const newTimes = [...mTimes];
    newTimes[idx] = val;
    setMTimes(newTimes);
  };
  const removeTimeSlot = (idx: number) => {
    if (mTimes.length > 1) {
      setMTimes(mTimes.filter((_, i) => i !== idx));
    }
  };

  useEffect(() => {
    const fetchCg = async () => {
      const q = query(collection(db, 'caregivers'), where('__name__', '==', caregiverId));
      onSnapshot(q, (snap) => {
        if (!snap.empty) {
          setCgProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      });
    };
    fetchCg();

    const q = query(collection(db, 'patients'), where('caregiverIds', 'array-contains', caregiverId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [caregiverId]);

  useEffect(() => {
    if (selectedPatient) {
      const vq = query(collection(db, 'vitals'), where('patientId', '==', selectedPatient));
      const vu = onSnapshot(vq, (snapshot) => {
        setVitals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      const mq = query(collection(db, 'medications'), where('patientId', '==', selectedPatient));
      const mu = onSnapshot(mq, (snapshot) => {
        setMeds(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      const aq = query(collection(db, 'aiReports'), where('patientId', '==', selectedPatient));
      const au = onSnapshot(aq, (snapshot) => {
        setAiReportsHistory(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      });

      const appq = query(collection(db, 'appointments'), where('patientId', '==', selectedPatient));
      const appu = onSnapshot(appq, (snapshot) => {
        setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()));
      });

      return () => { vu(); mu(); au(); appu(); };
    } else {
      setVitals([]);
      setMeds([]);
      setActiveVitalTab('');
      setEntryVital('');
      setAiReport('');
      setAiReportsHistory([]);
      setEditingMedId(null);
      setAppointments([]);
      setEditingAppId(null);
    }
  }, [selectedPatient]);

  const uploadToR2 = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('https://upload-worker.mohsiniqbalava007.workers.dev/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      return data.success ? data.url : '';
    } catch (e) {
      console.error(e);
      return '';
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    let profilePicUrl = '';

    if (pFile) {
      profilePicUrl = await uploadToR2(pFile);
    }

    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();

    await addDoc(collection(db, "patients"), {
      username: pUser,
      password: pPass, // in real app encrypt this
      age: Number(pAge),
      weight: Number(pWeight),
      height: Number(pHeight),
      gender: pGender,
      bloodType: pBloodType,
      notes: pNotes,
      profilePicture: profilePicUrl,
      caregiverIds: [caregiverId],
      refererId: uniqueId,
      trackedVitals: []
    });

    setPUser(''); setPPass(''); setPAge(''); setPWeight(''); setPHeight(''); setPGender(''); setPBloodType(''); setPNotes(''); setPFile(null);
    setIsUploading(false);
    alert(`Patient profile created! Their Referer ID is ${uniqueId}`);
  };

  const openEditPatient = (p: any) => {
    setEditingPatient(p);
    setEditPUser(p.username || '');
    setEditPPass(p.password || '');
    setEditPAge(p.age || '');
    setEditPWeight(p.weight || '');
    setEditPHeight(p.height || '');
    setEditPGender(p.gender || '');
    setEditPBloodType(p.bloodType || '');
    setEditPNotes(p.notes || '');
    setEditPFile(null);
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setEditIsUploading(true);
    let profilePicUrl = editingPatient.profilePicture || '';

    if (editPFile) {
      const url = await uploadToR2(editPFile);
      if (url) profilePicUrl = url;
    }

    try {
      await updateDoc(doc(db, "patients", editingPatient.id), {
        username: editPUser,
        password: editPPass,
        age: Number(editPAge),
        weight: Number(editPWeight),
        height: Number(editPHeight),
        gender: editPGender,
        bloodType: editPBloodType,
        notes: editPNotes,
        profilePicture: profilePicUrl
      });
      setEditingPatient(null);
      alert('Patient profile updated successfully!');
    } catch (err: any) {
      alert("Error updating patient: " + err.message);
    }
    setEditIsUploading(false);
  };

  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkRefId.trim()) return;

    // Find the patient with the matching refererId
    const q = query(collection(db, 'patients'), where('refererId', '==', linkRefId.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) {
      alert("Invalid Referer ID or patient not found.");
      return;
    }

    const patientDoc = snap.docs[0];
    await updateDoc(doc(db, "patients", patientDoc.id), {
      caregiverIds: arrayUnion(caregiverId)
    });

    setLinkRefId('');
    alert("Patient linked successfully!");
  };

  const handleUpdateCaregiverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cgProfile) return;
    setIsUploading(true);
    let profilePicUrl = cgProfile.profilePicture || '';

    if (pFile) {
      profilePicUrl = await uploadToR2(pFile);
    }

    await updateDoc(doc(db, "caregivers", caregiverId), {
      name: cgProfile.name,
      occupation: cgProfile.occupation,
      phone: cgProfile.phone,
      profilePicture: profilePicUrl
    });

    setPFile(null);
    setIsUploading(false);
    alert("Caregiver profile updated!");
  };

  const currentPatient = useMemo(() => patients.find(p => p.id === selectedPatient), [patients, selectedPatient]);
  const trackedVitals = currentPatient?.trackedVitals || [];

  useEffect(() => {
    if (trackedVitals.length > 0 && !trackedVitals.includes(activeVitalTab)) {
      setActiveVitalTab(trackedVitals[0]);
    }
    if (trackedVitals.length > 0 && !trackedVitals.includes(entryVital)) {
      setEntryVital(trackedVitals[0]);
    }
  }, [trackedVitals]);

  const handleDefineVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !newVitalDef.trim()) return;

    await updateDoc(doc(db, "patients", selectedPatient), {
      trackedVitals: arrayUnion(newVitalDef.trim())
    });
    setNewVitalDef('');
  };

  const handleRemoveVitalItem = async (vitalName: string) => {
    if (!window.confirm(`Remove ${vitalName} from tracked vitals?`)) return;
    await updateDoc(doc(db, "patients", selectedPatient), {
      trackedVitals: arrayRemove(vitalName)
    });
  };

  const handleAddVitalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !entryVital || !entryValue) return alert("Fill in details");
    await addDoc(collection(db, "vitals"), {
      patientId: selectedPatient,
      name: entryVital,
      value: Number(entryValue),
      timestamp: new Date().toISOString()
    });
    setEntryValue('');
    alert("Vital recorded!");
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert("Select a patient");
    const validTimes = mTimes.filter(t => t);
    if (validTimes.length === 0) return alert("Add at least one time");

    if (editingMedId) {
      const existingMed = meds.find(m => m.id === editingMedId);
      const updatedTimes = validTimes.map(t => {
        const existingT = existingMed?.times?.find((ot: any) => ot.time === t);
        return existingT ? existingT : { time: t, taken: false, lastNotified: "" };
      });
      await updateDoc(doc(db, "medications", editingMedId), {
        name: mName,
        dose: mDose,
        times: updatedTimes
      });
      setEditingMedId(null);
      alert("Medication updated!");
    } else {
      await addDoc(collection(db, "medications"), {
        patientId: selectedPatient,
        name: mName,
        dose: mDose,
        times: validTimes.map(t => ({ time: t, taken: false, lastNotified: "" }))
      });
      alert("Medication scheduled!");
    }

    setMName(''); setMDose(''); setMTimes(['']);
  };

  const handleEditMedication = (m: any) => {
    setEditingMedId(m.id);
    setMName(m.name);
    setMDose(m.dose);
    setMTimes(m.times && m.times.length > 0 ? m.times.map((t: any) => t.time) : ['']);
  };

  const cancelEdit = () => {
    setEditingMedId(null);
    setMName(''); setMDose(''); setMTimes(['']);
  };

  const handleDeleteMedication = async (id: string) => {
    await deleteDoc(doc(db, "medications", id));
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert("Select a patient");
    if (editingAppId) {
      await updateDoc(doc(db, "appointments", editingAppId), {
        title: appName, date: appDate, time: appTime, location: appLocation, notes: appNotes
      });
      setEditingAppId(null);
      alert("Appointment updated!");
    } else {
      await addDoc(collection(db, "appointments"), {
        patientId: selectedPatient, title: appName, date: appDate, time: appTime, location: appLocation, notes: appNotes, notified: false
      });
      alert("Appointment scheduled!");
    }
    setAppName(''); setAppDate(''); setAppTime(''); setAppLocation(''); setAppNotes('');
  };

  const handleEditAppointment = (app: any) => {
    setEditingAppId(app.id); setAppName(app.title); setAppDate(app.date); setAppTime(app.time); setAppLocation(app.location); setAppNotes(app.notes || '');
  };

  const cancelEditApp = () => {
    setEditingAppId(null); setAppName(''); setAppDate(''); setAppTime(''); setAppLocation(''); setAppNotes('');
  };

  const handleDeleteAppointment = async (id: string) => {
    if (window.confirm("Delete this appointment?")) await deleteDoc(doc(db, "appointments", id));
  };

  const chartData = useMemo(() => {
    if (!activeVitalTab) return [];
    const filtered = vitals.filter(v => v.name === activeVitalTab).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return filtered.map(v => ({
      ...v,
      timeLabel: new Date(v.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    }));
  }, [vitals, activeVitalTab]);

  const handleDownloadCSV = () => {
    if (vitals.length === 0) return alert("No vitals data to download.");

    // Create CSV Header
    let csvContent = "Vital Name,Date & Time,Value\n";

    // Append rows sorted by timestamp
    const sortedVitals = [...vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedVitals.forEach(row => {
      const timeLabel = new Date(row.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const escapedTime = `"${timeLabel}"`;
      const escapedName = `"${row.name}"`;
      csvContent += `${escapedName},${escapedTime},${row.value}\n`;
    });

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${currentPatient?.username || 'Patient'}_Full_Vitals_History.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPatient || trackedVitals.length === 0) return;

    setOcrError('');
    setOcrStatus('extracting');
    setParsedVitalsList(null);

    try {
      const extractedText = await extractTextFromFile(file);
      setOcrStatus('analyzing');

      const res = await fetch('https://vitals-ocr-parser.mohsiniqbalava007.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedText, expectedVitals: trackedVitals })
      });

      if (!res.ok) throw new Error("AI Server Error");
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Failed to parse");

      const vitalsObj = data.vitals;
      const parsedParams = Object.keys(vitalsObj).map(key => ({
        name: key,
        value: typeof vitalsObj[key] === 'number' ? vitalsObj[key] : parseFloat(vitalsObj[key])
      })).filter(v => !isNaN(v.value));

      if (parsedParams.length === 0) {
        throw new Error("No matching vitals found in document.");
      }

      setParsedVitalsList(parsedParams);
      setOcrStatus('');
    } catch (err: any) {
      console.error(err);
      setOcrError(err.message || 'OCR processing failed');
      setOcrStatus('');
    }
  };

  const confirmOCRVitals = async () => {
    if (!parsedVitalsList || !selectedPatient) return;
    const now = new Date().toISOString();

    for (const v of parsedVitalsList) {
      await addDoc(collection(db, "vitals"), {
        patientId: selectedPatient,
        name: v.name,
        value: v.value,
        timestamp: now
      });
    }

    setParsedVitalsList(null);
    alert("Extracted Vitals Logged!");
  };

  const handleGenerateAIReport = async () => {
    if (vitals.length === 0) return alert("Not enough data to analyze.");

    setIsGeneratingAI(true);
    setAiReport('');

    try {
      // Format all vitals for Gemini
      const formattedVitals = [...vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map(v => ({
        name: v.name,
        value: v.value,
        timeLabel: new Date(v.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      }));

      // Construct Patient Context
      const patientObj = patients.find(p => p.id === selectedPatient);
      const patientContext = patientObj ? {
        age: patientObj.age,
        gender: patientObj.gender,
        weight: patientObj.weight,
        height: patientObj.height,
        bloodType: patientObj.bloodType,
        notes: patientObj.notes
      } : null;

      // Send the active vital data payload to our new Cloudflare Gemini AI Worker
      const res = await fetch('https://care-ai-worker.mohsiniqbalava007.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vitals: formattedVitals, patientContext })
      });

      if (!res.ok) throw new Error("AI request failed.");

      const json = await res.json();
      setAiReport(json.report);

      // Save report to database
      await addDoc(collection(db, "aiReports"), {
        patientId: selectedPatient,
        report: json.report,
        timestamp: new Date().toISOString()
      });
      alert("AI Report generated and saved successfully!");

    } catch (err) {
      alert("Failed to contact Gemini AI. Check console for details.");
      console.error(err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative z-10 w-full max-w-7xl mx-auto">
      {/* Premium Segmented Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-hide">
        {[
          { id: 'patients', label: 'Manage Patients', icon: Users },
          { id: 'vitals', label: 'Track Vitals', icon: Activity },
          { id: 'meds', label: 'Medications', icon: Pill },
          { id: 'appointments', label: 'Appointments', icon: CalendarClock },
          { id: 'profile', label: 'My Profile', icon: User }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`relative flex items-center space-x-2 px-5 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'text-brand-700 dark:text-brand-300 bg-white dark:bg-dark-surface shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-dark-surface/50'}`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border" style={{ zIndex: -1 }} transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {['vitals', 'meds', 'appointments'].includes(activeTab) && (
        <select
          className="w-full max-w-md bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-gray-900 dark:text-white outline-none transition-colors mb-4"
          value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
        >
          <option value="">Select a Patient...</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>{p.username}</option>
          ))}
        </select>
      )}

      {activeTab === 'profile' as any && cgProfile && (
        <div className="max-w-xl bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
          <h2 className="text-xl font-bold mb-6 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-dark-border pb-2">Caregiver Setup / Profile</h2>
          <div className="flex items-center space-x-4 mb-6">
            {cgProfile.profilePicture ? (
              <img src={cgProfile.profilePicture} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-blue-100" />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-bold border-2 border-dashed border-gray-300">N/A</div>
            )}
            <div>
              <p className="font-bold text-lg">{cgProfile.name || 'Unnamed'}</p>
              <p className="text-gray-500 text-sm">Update your avatar by picking a file below.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateCaregiverProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Profile Image (optional)</label>
              <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                <input type="file" accept="image/*" onChange={e => setPFile(e.target.files?.[0] || null)} className="hidden" />
                <div className="flex flex-col items-center space-y-2 text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-medium">{pFile ? pFile.name : 'Click to browse. Max 5MB'}</span>
                </div>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
              <input type="text" value={cgProfile.name || ''} onChange={e => setCgProfile({ ...cgProfile, name: e.target.value })} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none transition-colors" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Occupation / Title</label>
              <input type="text" value={cgProfile.occupation || ''} onChange={e => setCgProfile({ ...cgProfile, occupation: e.target.value })} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none transition-colors" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E.164 Phone Number</label>
              <input type="text" value={cgProfile.phone || ''} onChange={e => setCgProfile({ ...cgProfile, phone: e.target.value })} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none transition-colors" required />
            </div>
            <button type="submit" disabled={isUploading} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-brand-500/30 active:scale-[0.98]">
              {isUploading ? 'Saving & Uploading...' : 'Update Profile'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="grid md:grid-cols-2 gap-6 w-full items-start">
          <form onSubmit={handleAddPatient} className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-fit">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-dark-border pb-2">Add New Patient</h2>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">Display Full Name</label>
            <input type="text" value={pUser} onChange={e => setPUser(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 mb-3 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" required />

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Password (Temp)</label>
            <input type="text" value={pPass} onChange={e => setPPass(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 mb-3 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" required />

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Age</label>
                <input type="number" value={pAge} onChange={e => setPAge(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Weight (kg)</label>
                <input type="number" value={pWeight} onChange={e => setPWeight(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Height (cm)</label>
                <input type="number" value={pHeight} onChange={e => setPHeight(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                <select value={pGender} onChange={e => setPGender(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors">
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Blood Type</label>
                <input type="text" placeholder="e.g. O+" value={pBloodType} onChange={e => setPBloodType(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Clinical Notes</label>
              <textarea placeholder="Allergies, chronic issues, etc." value={pNotes} onChange={e => setPNotes(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors h-24 resize-none" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Upload Profile Picture (optional)</label>
              <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                <input type="file" accept="image/*" onChange={e => setPFile(e.target.files?.[0] || null)} className="hidden" />
                <div className="flex flex-col items-center space-y-2 text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm font-medium">{pFile ? pFile.name : 'Click to browse. Max 5MB'}</span>
                </div>
              </label>
            </div>

            <button type="submit" disabled={isUploading} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-brand-500/30 active:scale-[0.98]">
              {isUploading ? 'Uploading & Creating...' : 'Create Patient Profile'}
            </button>
          </form>

          <div className="flex flex-col space-y-6">
            <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 flex flex-col space-y-4">
              <h2 className="text-xl font-bold mb-4 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Users className="w-5 h-5 text-brand-500" />
                <span>Your Managed Patients</span>
              </h2>

              {patients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border">
                  <UserPlus className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No patients tracked yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                  {patients.map((p, i) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      key={p.id}
                      className="group p-5 bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-start space-x-4 mb-4">
                        {p.profilePicture ? (
                          <img src={p.profilePicture} alt={p.username} className="w-14 h-14 rounded-full object-cover shadow-sm ring-2 ring-gray-100 dark:ring-dark-border" />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-brand-100 to-brand-200 dark:from-brand-900/50 dark:to-brand-800/50 text-brand-700 dark:text-brand-300 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">{p.username?.charAt(0) || '?'}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{p.username}</h3>
                          <div className="flex flex-wrap text-sm text-gray-500 dark:text-gray-400 mt-1 gap-x-3 gap-y-1 font-medium">
                            {p.age && <span>{p.age} yrs</span>}
                            {p.gender && <span>{p.gender}</span>}
                            {p.bloodType && <span className="text-red-500/80 dark:text-red-400 flex items-center"><Activity className="w-3 h-3 mr-1" />{p.bloodType}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-dark-border">
                        <div className="bg-gray-50 dark:bg-dark-bg px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                          <code className="text-xs font-bold text-gray-600 dark:text-gray-400">ID: {p.refererId || 'N/A'}</code>
                        </div>
                        <button onClick={() => openEditPatient(p)} className="flex items-center space-x-1 text-sm bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors font-semibold">
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {editingPatient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-dark-border">
                  <form onSubmit={handleUpdatePatient} className="p-6">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-dark-border pb-2">
                      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Patient</h2>
                      <button type="button" onClick={() => setEditingPatient(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">&times;</button>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">Display Full Name</label>
                    <input type="text" value={editPUser} onChange={e => setEditPUser(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 mb-3 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" required />

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Password (Temp)</label>
                    <input type="text" value={editPPass} onChange={e => setEditPPass(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 mb-3 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" required />

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Age</label>
                        <input type="number" value={editPAge} onChange={e => setEditPAge(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Weight (kg)</label>
                        <input type="number" value={editPWeight} onChange={e => setEditPWeight(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Height (cm)</label>
                        <input type="number" value={editPHeight} onChange={e => setEditPHeight(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                        <select value={editPGender} onChange={e => setEditPGender(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors">
                          <option value="">Select...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Blood Type</label>
                        <input type="text" placeholder="e.g. O+" value={editPBloodType} onChange={e => setEditPBloodType(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Clinical Notes</label>
                      <textarea placeholder="Allergies, chronic issues, etc." value={editPNotes} onChange={e => setEditPNotes(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors h-24 resize-none" />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Upload New Profile Picture (optional)</label>
                      <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                        <input type="file" accept="image/*" onChange={e => setEditPFile(e.target.files?.[0] || null)} className="hidden" />
                        <div className="flex flex-col items-center space-y-2 text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">
                          <Upload className="w-6 h-6" />
                          <span className="text-sm font-medium">{editPFile ? editPFile.name : 'Click to browse. Max 5MB'}</span>
                        </div>
                      </label>
                    </div>

                    <button type="submit" disabled={editIsUploading} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-brand-500/30 active:scale-[0.98]">
                      {editIsUploading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleLinkPatient} className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border h-fit">
            <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-dark-border pb-2">Link Existing Patient</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Enter a patient's Referer ID to gain access to their ongoing care dashboard.</p>

            <div className="flex space-x-2">
              <input type="text" placeholder="e.g. 5X8P2K" value={linkRefId} onChange={e => setLinkRefId(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border p-2.5 rounded-xl uppercase font-mono text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 transition-colors" required />
              <button type="submit" className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 transition-all text-white px-5 font-bold rounded-xl whitespace-nowrap text-sm shadow-lg shadow-green-500/30 active:scale-[0.98]">Link Profile</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'vitals' && selectedPatient && (
        <div className="space-y-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 w-full items-start">
            <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 flex flex-col space-y-4 shadow-sm border border-gray-100 dark:border-dark-border">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Activity className="w-5 h-5 text-brand-500" />
                <span>1. Define Tracked Vitals</span>
              </h2>
              <form onSubmit={handleDefineVital} className="flex space-x-3 mb-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="e.g. Systolic BP"
                    value={newVitalDef}
                    onChange={e => setNewVitalDef(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 pl-4 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <button type="submit" className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 px-5 rounded-xl transition-all shadow-md flex items-center justify-center transform active:scale-95">
                  <Plus className="w-5 h-5" />
                </button>
              </form>

              <div className="flex flex-wrap gap-2 pt-2">
                {trackedVitals.map((v: string) => (
                  <span key={v} className="bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-sm px-4 py-1.5 rounded-full flex items-center border border-brand-100 dark:border-brand-800/50 shadow-sm transition-transform hover:scale-105">
                    <span className="font-semibold">{v}</span>
                    <button onClick={() => handleRemoveVitalItem(v)} className="ml-2 text-brand-400 hover:text-brand-600 dark:hover:text-brand-200 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
                {trackedVitals.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center"><Activity className="w-4 h-4 mr-1" /> No vitals defined yet.</p>}
              </div>
            </div>

            <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 flex flex-col space-y-4 shadow-sm border border-gray-100 dark:border-dark-border">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Plus className="w-5 h-5 text-brand-500" />
                <span>2. Log Vital Entry</span>
              </h2>
              {trackedVitals.length > 0 ? (
                <form onSubmit={handleAddVitalEntry} className="space-y-4 mt-2">
                  <div className="relative">
                    <select value={entryVital} onChange={e => setEntryVital(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 pl-4 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all appearance-none font-medium" required>
                      {trackedVitals.map((v: string) => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <ChevronRight className="w-5 h-5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                  </div>
                  <div className="relative">
                    <input type="number" step="any" placeholder="Enter Value" value={entryValue} onChange={e => setEntryValue(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 pl-4 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold p-3.5 rounded-xl shadow-lg shadow-brand-500/30 transform active:scale-[0.98] flex items-center justify-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>Save Reading</span>
                  </button>
                </form>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-dark-bg/50 rounded-xl border border-dashed border-gray-200 dark:border-dark-border p-6">
                  <Activity className="w-8 h-8 opacity-50 mb-2" />
                  <p className="text-sm font-medium text-center">Please define some vitals first to start logging entries.</p>
                </div>
              )}
            </div>

            <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 flex flex-col space-y-4 shadow-sm border border-gray-100 dark:border-dark-border">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <FileUp className="w-5 h-5 text-brand-500" />
                <span>3. Auto-Log via OCR Image/PDF</span>
              </h2>
              {trackedVitals.length > 0 ? (
                <div className="space-y-4">
                  {!parsedVitalsList && !ocrStatus && (
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                      <input type="file" accept="image/*,application/pdf" onChange={handleOCRUpload} className="hidden" />
                      <FileUp className="w-8 h-8 text-gray-400 group-hover:text-brand-500 mb-2 transition-colors" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Upload Lab Report/Image</span>
                    </label>
                  )}

                  {ocrStatus && (
                    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-dark-bg rounded-xl border border-gray-200 dark:border-dark-border">
                      <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-3" />
                      <p className="font-bold text-gray-700 dark:text-gray-200">
                        {ocrStatus === 'extracting' ? 'Extracting text from document...' : 'AI Analyzing Vitals...'}
                      </p>
                    </div>
                  )}

                  {ocrError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/50">
                      Error: {ocrError}
                      <button onClick={() => setOcrError('')} className="block mt-2 underline cursor-pointer">Try Again</button>
                    </div>
                  )}

                  {parsedVitalsList && (
                    <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-xl border border-brand-100 dark:border-brand-800/50">
                      <h3 className="font-bold text-brand-900 dark:text-brand-100 mb-3 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1 text-green-500" /> Found these vitals:</h3>
                      <ul className="space-y-2 mb-4">
                        {parsedVitalsList.map((v, i) => (
                          <li key={i} className="flex justify-between items-center text-sm font-medium text-gray-800 dark:text-gray-200 bg-white dark:bg-dark-surface p-2 rounded-lg shadow-sm border border-gray-100 dark:border-dark-border">
                            <span>{v.name}</span>
                            <span className="text-brand-600 dark:text-brand-400 font-bold">{v.value}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex space-x-2">
                        <button onClick={confirmOCRVitals} className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold py-2.5 rounded-xl shadow-md transition-transform active:scale-95">Confirm & Log All</button>
                        <button onClick={() => setParsedVitalsList(null)} className="px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl transition-colors">Discard</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-dark-bg/50 rounded-xl border border-dashed border-gray-200 dark:border-dark-border p-6">
                  <FileUp className="w-8 h-8 opacity-50 mb-2" />
                  <p className="text-sm font-medium text-center">Define vitals to enable auto-logging.</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <Activity className="w-6 h-6 text-brand-500" />
                <span>Vitals History & Graph</span>
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {trackedVitals.length > 0 && activeVitalTab && (
                  <>
                    <button
                      onClick={handleGenerateAIReport}
                      disabled={isGeneratingAI}
                      className="relative group bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-purple-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center disabled:opacity-50 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                      <Sparkles className={`w-4 h-4 mr-2 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                      <span className="relative z-10">{isGeneratingAI ? 'Analyzing Vitals...' : 'Generate AI Report'}</span>
                    </button>
                    <button onClick={handleDownloadCSV} className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center transform hover:scale-105 active:scale-95">
                      <Download className="w-4 h-4 mr-2" />
                      <span>Export CSV</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {trackedVitals.length > 0 && (
              <div className="flex space-x-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {trackedVitals.map((v: string) => (
                  <button
                    key={v}
                    onClick={() => setActiveVitalTab(v)}
                    className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeVitalTab === v ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 shadow-sm border border-brand-100 dark:border-brand-800/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg border border-transparent'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            {activeVitalTab && (
              <div className="h-64 sm:h-80 w-full mb-6 relative">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="timeLabel"
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="#9ca3af"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                        labelStyle={{ color: '#6b7280', fontWeight: 'bold', marginBottom: '4px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border">
                    <Activity className="w-8 h-8 opacity-50 mb-2" />
                    <p className="text-sm font-medium">No recorded data for {activeVitalTab}</p>
                  </div>
                )}
              </div>
            )}

            {chartData.length > 0 && (
              <div className="mt-8 border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-gray-50 dark:bg-dark-bg">
                    <tr>
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-dark-border">Date & Time</th>
                      <th className="px-6 py-3 border-b border-gray-200 dark:border-dark-border">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice().reverse().map((data: any) => (
                      <tr key={data.id} className="bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg/80 transition-colors">
                        <td className="px-6 py-4">{data.timeLabel}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{data.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <AnimatePresence>
            {aiReport && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 p-6 lg:p-8 rounded-3xl border border-purple-100 dark:border-purple-800/30 shadow-md relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-400/10 dark:bg-purple-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="flex justify-between items-center mb-6 relative z-10">
                  <h3 className="font-bold text-purple-900 dark:text-purple-300 flex items-center space-x-2 text-xl">
                    <Sparkles className="w-6 h-6 text-purple-500" />
                    <span>Latest AI Analysis Context</span>
                  </h3>
                  <button onClick={() => setAiReport('')} className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 bg-white/50 dark:bg-dark-surface/50 p-2 rounded-full transition-colors backdrop-blur-sm">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="prose prose-purple dark:prose-invert prose-sm sm:prose-base max-w-none text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed relative z-10 font-medium">
                  {aiReport}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {
            aiReportsHistory.length > 0 && (
              <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center space-x-2 text-xl">
                  <FileText className="w-6 h-6 text-brand-500" />
                  <span>Previous AI Reports ({aiReportsHistory.length})</span>
                </h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {aiReportsHistory.map((report: any) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      key={report.id}
                      className="bg-gray-50/80 dark:bg-dark-bg/80 p-5 rounded-2xl border border-gray-100 dark:border-dark-border/60 hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors shadow-sm"
                    >
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold px-2.5 py-1 rounded-md">
                          {new Date(report.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed line-clamp-3 hover:line-clamp-none transition-all duration-300">
                        {report.report}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {activeTab === 'meds' && selectedPatient && (
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-2 gap-6 items-start">
            <form onSubmit={handleAddMedication} className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border h-fit flex flex-col space-y-4">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <Pill className="w-5 h-5 text-brand-500" />
                <span>{editingMedId ? "Edit Medication Profile" : "Add New Medication"}</span>
              </h2>

              <div className="space-y-4">
                <div className="relative">
                  <input type="text" placeholder="Medication Name (e.g. Lisinopril)" value={mName} onChange={e => setMName(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                </div>
                <div className="relative">
                  <input type="text" placeholder="Dosage (e.g. 10mg)" value={mDose} onChange={e => setMDose(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                </div>

                <div className="bg-gray-50/50 dark:bg-dark-bg/50 p-4 rounded-2xl border border-gray-100 dark:border-dark-border/50">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <CalendarClock className="w-4 h-4 mr-1.5 opacity-70" />
                    Scheduled Times
                  </label>
                  <div className="space-y-3">
                    {mTimes.map((t, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input type="time" value={t} onChange={e => updateTimeSlot(idx, e.target.value)} className="flex-1 border p-2.5 rounded-xl bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all" required />
                        {mTimes.length > 1 && (
                          <button type="button" onClick={() => removeTimeSlot(idx)} className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 transition-colors">
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addTimeSlot} className="text-sm text-brand-600 dark:text-brand-400 font-bold flex items-center hover:text-brand-700 dark:hover:text-brand-300 transition-colors pt-2">
                      <Plus className="w-4 h-4 mr-1" /> Add Time Slot
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button type="submit" className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold p-3 rounded-xl shadow-lg shadow-brand-500/30 transform active:scale-[0.98]">
                    {editingMedId ? "Update Med" : "Save Medication"}
                  </button>
                  {editingMedId && (
                    <button type="button" onClick={cancelEdit} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold p-3 rounded-xl transition-all transform active:scale-[0.98]">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border flex flex-col space-y-4">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-dark-border pb-4">
                <Activity className="w-5 h-5 text-brand-500" />
                <span>Current & Active Prescriptions</span>
              </h2>
              {meds.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <Pill className="w-10 h-10 opacity-20 mb-3" />
                  <p className="font-medium text-sm">No active medications registered.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {meds.map((m, i) => (
                    <motion.li
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      key={m.id}
                      className="p-4 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl flex justify-between items-start border border-gray-100 dark:border-dark-border/50 group hover:border-brand-200 dark:hover:border-brand-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-gray-900 dark:text-white truncate text-base">{m.name}</span>
                          <span className="px-2 py-0.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-md text-xs font-bold whitespace-nowrap">{m.dose}</span>
                        </div>
                        <div className="mt-3 flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            {m.times && m.times.map((t: any, i: number) => (
                              <div key={i} className="flex items-center bg-white dark:bg-dark-surface px-2.5 py-1 rounded-lg border border-gray-200 dark:border-dark-border/80 shadow-sm">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 mr-2 uppercase tracking-wide">{t.time}</span>
                                <div className={`w-2 h-2 rounded-full ${t.taken ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`}></div>
                              </div>
                            ))}
                          </div>
                          {m.proofUrl && (
                            <a href={m.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 px-3 py-1.5 rounded-lg w-fit border border-brand-100 dark:border-brand-800/50">
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Last Recorded Proof Photo</span>
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditMedication(m)} className="p-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg transition-colors flex items-center justify-center">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteMedication(m.id)} className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 rounded-lg transition-colors flex items-center justify-center">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {activeTab === 'appointments' && selectedPatient && (
        <AnimatePresence mode="wait">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid md:grid-cols-2 gap-6 items-start">
            <form onSubmit={handleAddAppointment} className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border h-fit flex flex-col space-y-4">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                <CalendarClock className="w-5 h-5 text-brand-500" />
                <span>{editingAppId ? "Edit Appointment" : "Schedule New Appointment"}</span>
              </h2>

              <div className="space-y-4">
                <div className="relative">
                  <input type="text" placeholder="Title (e.g. Blood Test, Checkup)" value={appName} onChange={e => setAppName(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">Date</label>
                    <input type="date" value={appDate} onChange={e => setAppDate(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                  </div>
                  <div className="relative">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 block">Time</label>
                    <input type="time" value={appTime} onChange={e => setAppTime(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-gray-400" />
                  </div>
                  <input type="text" placeholder="Location Details" value={appLocation} onChange={e => setAppLocation(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 pl-9 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all" required />
                </div>

                <div className="relative">
                  <textarea placeholder="Additional Notes or Instructions (Optional)" value={appNotes} onChange={e => setAppNotes(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all h-24 resize-none"></textarea>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button type="submit" className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold p-3 rounded-xl shadow-lg shadow-brand-500/30 transform active:scale-[0.98]">
                    {editingAppId ? "Update Appointment" : "Save Appointment"}
                  </button>
                  {editingAppId && (
                    <button type="button" onClick={cancelEditApp} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold p-3 rounded-xl transition-all transform active:scale-[0.98]">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>

            <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border flex flex-col space-y-4">
              <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-dark-border pb-4">
                <CalendarClock className="w-5 h-5 text-brand-500" />
                <span>Upcoming Appointments</span>
              </h2>
              {appointments.filter(a => a.patientId === selectedPatient).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <CalendarClock className="w-10 h-10 opacity-20 mb-3" />
                  <p className="font-medium text-sm">No upcoming appointments scheduled.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {appointments.filter(a => a.patientId === selectedPatient)
                    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                    .map((app, i) => {
                      const isPast = new Date(`${app.date}T${app.time}`) < new Date();
                      return (
                        <motion.li
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          key={app.id}
                          className={`p-4 rounded-2xl flex justify-between items-start border group transition-all ${isPast ? 'bg-gray-50/30 dark:bg-dark-bg/20 border-gray-200/50 dark:border-dark-border/30 opacity-60' : 'bg-gray-50/50 dark:bg-dark-bg/50 border-gray-100 dark:border-dark-border/50 hover:border-brand-200 dark:hover:border-brand-800'}`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-gray-900 dark:text-white truncate text-base">{app.title}</span>
                              <span className={`px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap ${isPast ? 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'}`}>{app.date} at {app.time}</span>
                            </div>
                            <div className="flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">
                              <MapPin className="w-3.5 h-3.5 mr-1" />
                              <span className="truncate">{app.location}</span>
                            </div>
                            {app.notes && (
                              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-dark-surface p-2 rounded-lg border border-gray-100 dark:border-dark-border">
                                {app.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditAppointment(app)} className="p-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg transition-colors flex items-center justify-center">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteAppointment(app.id)} className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 rounded-lg transition-colors flex items-center justify-center">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.li>
                      );
                    })}
                </ul>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div >
  );
}
