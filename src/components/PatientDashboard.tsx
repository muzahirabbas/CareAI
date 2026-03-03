import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Activity, User, Download, Pill, CheckCircle2, Circle, FileText, Sparkles, MapPin, Edit2, Upload, Plus, ChevronRight, Loader2, FileUp, X, Camera } from 'lucide-react';
import { extractTextFromFile } from '../utils/ocr';

export function PatientDashboard({ patientId }: { patientId: string }) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'vitals' | 'profile'>('schedule');
  const [patientData, setPatientData] = useState<any>(null);

  const [meds, setMeds] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [activeVitalTab, setActiveVitalTab] = useState('');
  const [aiReportsHistory, setAiReportsHistory] = useState<any[]>([]);
  const [pFile, setPFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Manual Vital Logging State
  const [entryVital, setEntryVital] = useState('');
  const [entryValue, setEntryValue] = useState('');

  // OCR Vitals Extraction State
  const [ocrStatus, setOcrStatus] = useState<'' | 'extracting' | 'analyzing'>('');
  const [parsedVitalsList, setParsedVitalsList] = useState<{ name: string, value: number }[] | null>(null);
  const [ocrError, setOcrError] = useState('');

  const [activeMedProof, setActiveMedProof] = useState<{ id: string, name: string, timeIndex: number } | null>(null);
  const [medProofFile, setMedProofFile] = useState<File | null>(null);
  const [isUploadingMedProof, setIsUploadingMedProof] = useState(false);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please allow permissions or use the 'Choose File' option.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setMedProofFile(file);
            stopCamera();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  useEffect(() => {
    const pq = query(collection(db, 'patients'), where('__name__', '==', patientId));
    const uq = onSnapshot(pq, (snap) => {
      if (!snap.empty) {
        setPatientData({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    });

    const q = query(collection(db, 'medications'), where('patientId', '==', patientId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMeds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const aq = query(collection(db, 'appointments'), where('patientId', '==', patientId));
    const au = onSnapshot(aq, (snapshot) => {
      setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()));
    });

    const vq = query(collection(db, 'vitals'), where('patientId', '==', patientId));
    const vu = onSnapshot(vq, (snapshot) => {
      setVitals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const aiq = query(collection(db, 'aiReports'), where('patientId', '==', patientId));
    const aiu = onSnapshot(aiq, (snapshot) => {
      setAiReportsHistory(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });

    return () => { uq(); unsubscribe(); au(); vu(); aiu(); };
  }, [patientId]);

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

    let csvContent = "Vital Name,Date & Time,Value\n";
    const sortedVitals = [...vitals].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedVitals.forEach(row => {
      const timeLabel = new Date(row.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const escapedTime = `"${timeLabel}"`;
      const escapedName = `"${row.name}"`;
      csvContent += `${escapedName},${escapedTime},${row.value}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${patientData?.username || 'Patient'}_Full_Vitals_History.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uploadToR2 = async (file: File, prefix?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (prefix) formData.append('prefix', prefix);
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientData) return;
    setIsUploading(true);
    let profilePicUrl = patientData.profilePicture || '';

    if (pFile) {
      profilePicUrl = await uploadToR2(pFile);
    }

    await updateDoc(doc(db, "patients", patientId), {
      profilePicture: profilePicUrl
    });

    setPFile(null);
    setIsUploading(false);
    alert("Profile image updated!");
  };

  const handleAddVitalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryVital || !entryValue || !patientData) return;

    await addDoc(collection(db, "vitals"), {
      patientId,
      name: entryVital,
      value: parseFloat(entryValue),
      timestamp: new Date().toISOString()
    });

    setEntryValue('');
    alert("Reading logged!");
  };

  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientData || !patientData.trackedVitals || patientData.trackedVitals.length === 0) return;

    setOcrError('');
    setOcrStatus('extracting');
    setParsedVitalsList(null);

    try {
      const extractedText = await extractTextFromFile(file);
      setOcrStatus('analyzing');

      const res = await fetch('https://vitals-ocr-parser.mohsiniqbalava007.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extractedText, expectedVitals: patientData.trackedVitals })
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
    if (!parsedVitalsList || !patientData) return;
    const now = new Date().toISOString();

    for (const v of parsedVitalsList) {
      await addDoc(collection(db, "vitals"), {
        patientId: patientId,
        name: v.name,
        value: v.value,
        timestamp: now
      });
    }

    setParsedVitalsList(null);
    alert("Extracted Vitals Logged!");
  };

  const confirmMedAsTaken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMedProof || !medProofFile || !patientData) return;

    setIsUploadingMedProof(true);
    const proofUrl = await uploadToR2(medProofFile, 'med-proofs');

    const med = meds.find(m => m.id === activeMedProof.id);
    if (!med) { setIsUploadingMedProof(false); return; }

    const newTimes = [...med.times];
    newTimes[activeMedProof.timeIndex].taken = true;

    await updateDoc(doc(db, 'medications', activeMedProof.id), { times: newTimes, proofUrl: proofUrl });

    fetch('https://care-notifications-worker.mohsiniqbalava007.workers.dev/notify-caregiver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, medId: activeMedProof.id, medName: activeMedProof.name, status: 'taken', time: newTimes[activeMedProof.timeIndex].time, proofUrl })
    }).catch(console.error);

    setIsUploadingMedProof(false);
    setActiveMedProof(null);
    setMedProofFile(null);
  };

  return (
    <div className="space-y-8 animate-fade-in relative z-10 w-full max-w-5xl mx-auto">
      {/* Premium Segmented Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-4 scrollbar-hide">
        {[
          { id: 'schedule', label: 'My Schedule', icon: CalendarClock },
          { id: 'vitals', label: 'Vitals & Reports', icon: Activity },
          { id: 'profile', label: 'My Profile', icon: User }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`relative flex items-center space-x-2 px-6 py-3.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${activeTab === tab.id ? 'text-brand-700 dark:text-brand-300 bg-white dark:bg-dark-surface shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-dark-surface/50'}`}
          >
            {activeTab === tab.id && (
              <motion.div layoutId="patientTab" className="absolute inset-0 bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border" style={{ zIndex: -1 }} transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'schedule' && (
            <div className="space-y-8">
              <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border">
                <h3 className="text-2xl font-bold mb-6 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                  <Pill className="w-6 h-6 text-brand-500" />
                  <span>Today's Medications</span>
                </h3>
                {meds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border">
                    <Pill className="w-12 h-12 opacity-20 mb-3" />
                    <p className="font-medium">No medications scheduled for today.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {meds.map((med, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={med.id}
                        className="bg-gray-50/80 dark:bg-dark-bg/80 border border-gray-100 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="bg-white/60 dark:bg-dark-surface/60 p-4 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="bg-brand-100 dark:bg-brand-900/40 p-2.5 rounded-xl text-brand-600 dark:text-brand-400">
                              <Pill className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{med.name}</p>
                              <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{med.dose}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 space-y-3 relative">
                          <div className="absolute left-6 top-0 bottom-8 w-px bg-gray-200 dark:bg-gray-700/50" />
                          {med.times && med.times.map((t: any, idx: number) => (
                            <motion.div
                              layout
                              key={idx}
                              className={`relative flex items-center justify-between p-3.5 pr-4 rounded-xl border transition-all ${t.taken ? 'bg-green-50 dark:bg-green-900/10 border-green-200/60 dark:border-green-800/30 ml-8 opacity-70' : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border shadow-sm ml-8 hover:ml-9'}`}
                            >
                              <div className={`absolute -left-10 w-4 h-4 rounded-full border-4 shadow-sm z-10 transition-colors ${t.taken ? 'bg-green-500 border-green-100 dark:border-green-900 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-white dark:bg-dark-surface border-brand-500'}`} />
                              <span className={`font-bold text-lg ${t.taken ? 'text-green-700 dark:text-green-400 line-through decoration-green-300 dark:decoration-green-800/50' : 'text-gray-800 dark:text-gray-200'}`}>{t.time}</span>

                              <button
                                onClick={() => setActiveMedProof({ id: med.id, name: med.name, timeIndex: idx })}
                                disabled={t.taken}
                                className={`relative overflow-hidden group px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center space-x-2 ${t.taken ? 'bg-transparent text-green-600 dark:text-green-400' : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-lg shadow-brand-500/30 active:scale-95'}`}
                              >
                                {t.taken ? (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center space-x-1.5">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span>Taken</span>
                                  </motion.div>
                                ) : (
                                  <>
                                    <Circle className="w-4 h-4 text-white/70 group-hover:hidden" />
                                    <CheckCircle2 className="w-4 h-4 text-white hidden group-hover:block" />
                                    <span>Record Dose</span>
                                  </>
                                )}
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border mt-6">
                <h3 className="text-xl font-bold mb-6 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                  <CalendarClock className="w-6 h-6 text-brand-500" />
                  <span>Upcoming Appointments & Tests</span>
                </h3>
                {appointments.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 font-medium bg-gray-50/50 dark:bg-dark-bg/50 p-6 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border text-center">No appointments scheduled.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {appointments.map((app, i) => (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        key={app.id}
                        className="p-5 rounded-2xl bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-500/10 transition-colors" />
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-4 relative z-10 pr-4 leading-tight">{app.title}</h4>
                        <div className="space-y-2.5 relative z-10">
                          <div className="flex items-start space-x-2.5 text-gray-600 dark:text-gray-300">
                            <CalendarClock className="w-4 h-4 mt-0.5 text-brand-500" />
                            <span className="text-sm font-medium">{new Date(`${app.date}T${app.time}`).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</span>
                          </div>
                          <div className="flex items-start space-x-2.5 text-gray-600 dark:text-gray-300">
                            <MapPin className="w-4 h-4 mt-0.5 text-brand-500" />
                            <span className="text-sm font-medium">{app.location}</span>
                          </div>
                        </div>
                        {app.notes && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-bg rounded-xl border border-gray-100 dark:border-dark-border/50 text-sm italic text-gray-600 dark:text-gray-400 relative z-10">
                            {app.notes}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'vitals' && patientData && (
            <div className="space-y-8">
              <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
                    <Activity className="w-6 h-6 text-brand-500" />
                    <span>My Vitals Graph</span>
                  </h2>
                  {vitals.length > 0 && (
                    <button
                      onClick={handleDownloadCSV}
                      className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center transform hover:scale-105 active:scale-95"
                    >
                      <Download className="w-4 h-4 mr-2 text-brand-500" />
                      Export CSV Download
                    </button>
                  )}
                </div>

                {(patientData.trackedVitals || []).length > 0 ? (
                  <>
                    <div className="flex space-x-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                      {(patientData.trackedVitals || []).map((v: string) => (
                        <button
                          key={v}
                          onClick={() => setActiveVitalTab(v)}
                          className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeVitalTab === v ? 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/20 shadow-sm border border-brand-100 dark:border-brand-800/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-dark-bg border border-transparent'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>

                    {activeVitalTab && (
                      <div className="space-y-6">
                        <div className="h-64 sm:h-80 w-full relative">
                          {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis dataKey="timeLabel" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} labelStyle={{ color: '#6b7280', fontWeight: 'bold' }} />
                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border">
                              <Activity className="w-8 h-8 opacity-50 mb-2" />
                              <p className="text-sm font-medium">No data recorded yet for {activeVitalTab}.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-6 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                    <Activity className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm font-medium text-center">No vitals are currently being tracked by your Caregiver.</p>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6 w-full items-start">
                <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-dark-border">
                  <h2 className="text-xl font-bold mb-4 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                    <Plus className="w-5 h-5 text-brand-500" />
                    <span>Log a Vital Entry</span>
                  </h2>
                  {(patientData?.trackedVitals || []).length > 0 ? (
                    <form onSubmit={handleAddVitalEntry} className="space-y-4 max-w-md">
                      <div className="relative">
                        <select value={entryVital} onChange={e => setEntryVital(e.target.value)} className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border p-3 pl-4 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all appearance-none font-medium" required>
                          <option value="">Select a Vital</option>
                          {(patientData.trackedVitals || []).map((v: string) => <option key={v} value={v}>{v}</option>)}
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
                    <div className="p-6 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-dashed border-gray-200 dark:border-dark-border flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                      <Activity className="w-8 h-8 opacity-50 mb-2" />
                      <p className="text-sm font-medium text-center">Your caregiver needs to define which vitals to track first.</p>
                    </div>
                  )}
                </div>

                <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 flex flex-col space-y-4 shadow-sm border border-gray-100 dark:border-dark-border">
                  <h2 className="text-xl font-bold mb-2 flex items-center space-x-2 text-gray-900 dark:text-gray-100">
                    <FileUp className="w-5 h-5 text-brand-500" />
                    <span>Auto-Log via OCR Image/PDF</span>
                  </h2>
                  {(patientData?.trackedVitals || []).length > 0 ? (
                    <div className="space-y-4">
                      {!parsedVitalsList && !ocrStatus && (
                        <label className="cursor-pointer flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                          <input type="file" accept="image/*,application/pdf" onChange={handleOCRUpload} className="hidden" />
                          <FileUp className="w-8 h-8 text-gray-400 group-hover:text-brand-500 mb-2 transition-colors" />
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Upload Lab Report or Image</span>
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
                            <button onClick={confirmOCRVitals} className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold py-2.5 rounded-xl shadow-md transition-transform active:scale-95">Confirm All</button>
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

              {aiReportsHistory.length > 0 && (
                <div className="glass dark:glass-dark rounded-3xl p-6 lg:p-8 shadow-sm border border-purple-100 dark:border-purple-900/30">
                  <h3 className="font-bold text-purple-900 dark:text-purple-300 mb-6 flex items-center text-xl">
                    <Sparkles className="w-6 h-6 mr-2 text-purple-500" />
                    Gemini AI Medical Analyses
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {aiReportsHistory.map((report: any, i) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                        key={report.id}
                        className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 border border-purple-100/50 dark:border-purple-800/30 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-bold px-2.5 py-1 rounded-md">
                            {new Date(report.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-medium">{report.report}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && patientData && (
            <div className="max-w-xl mx-auto glass dark:glass-dark p-6 lg:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border">
              <h2 className="text-2xl font-bold mb-8 text-gray-900 dark:text-white flex items-center space-x-2 border-b border-gray-100 dark:border-dark-border pb-4">
                <User className="w-6 h-6 text-brand-500" />
                <span>My Profile Overview</span>
              </h2>

              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 mb-8 text-center sm:text-left">
                {patientData.profilePicture ? (
                  <img src={patientData.profilePicture} alt="Profile" className="w-28 h-28 rounded-full object-cover shadow-lg border-4 border-white dark:border-dark-surface" />
                ) : (
                  <div className="w-28 h-28 bg-gradient-to-br from-brand-100 to-brand-300 dark:from-brand-900 dark:to-brand-800 text-brand-700 dark:text-brand-200 rounded-full flex items-center justify-center font-bold text-4xl shadow-lg border-4 border-white dark:border-dark-surface">
                    {patientData.username?.charAt(0) || '?'}
                  </div>
                )}
                <div className="pt-2">
                  <p className="font-bold text-3xl text-gray-900 dark:text-white mb-3">{patientData.username}</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-medium">
                    <p className="text-gray-500 dark:text-gray-400">Age: <span className="text-gray-900 dark:text-gray-200 font-bold">{patientData.age || 'N/A'}</span></p>
                    <p className="text-gray-500 dark:text-gray-400">Sex: <span className="text-gray-900 dark:text-gray-200 font-bold">{patientData.gender || 'N/A'}</span></p>
                    <p className="text-gray-500 dark:text-gray-400">Blood: <span className="text-red-500 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800/50 px-1.5 rounded inline-flex items-center"><Activity className="w-3 h-3 mr-0.5" />{patientData.bloodType || 'N/A'}</span></p>
                    <p className="text-gray-500 dark:text-gray-400">W/H: <span className="text-gray-900 dark:text-gray-200 font-bold">{patientData.weight ? patientData.weight + 'kg' : '-'} / {patientData.height ? patientData.height + 'cm' : '-'}</span></p>
                  </div>
                </div>
              </div>

              {patientData.notes && (
                <div className="mb-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-500 mb-2 flex items-center relative z-10"><FileText className="w-4 h-4 mr-1.5" /> Clinical Notes</h4>
                  <p className="text-sm text-amber-900 dark:text-amber-200/80 leading-relaxed font-medium relative z-10">{patientData.notes}</p>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-5 pt-6 border-t border-gray-100 dark:border-dark-border">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Update Profile Picture</label>
                  <label className="cursor-pointer flex items-center justify-center w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
                    <input type="file" accept="image/*" onChange={e => setPFile(e.target.files?.[0] || null)} className="hidden" />
                    <div className="flex flex-col items-center space-y-2 text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">
                      <Upload className="w-6 h-6" />
                      <span className="text-sm font-medium">{pFile ? pFile.name : 'Click to browse. Max 5MB'}</span>
                    </div>
                  </label>
                </div>

                <button type="submit" disabled={isUploading || !pFile} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-brand-500/30 active:scale-[0.98]">
                  {isUploading ? 'Uploading Image...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {activeMedProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-dark-border overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50/50 dark:bg-dark-bg/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center"><Upload className="w-5 h-5 mr-2 text-brand-500" /> Record Dose Proof</h3>
              <button disabled={isUploadingMedProof} onClick={() => { setActiveMedProof(null); setMedProofFile(null); stopCamera(); }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={confirmMedAsTaken} className="p-6 space-y-6">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 text-center">Please attach a photo to mark <strong className="text-brand-600 dark:text-brand-400">{activeMedProof.name}</strong> as taken.</p>

              {!isCameraOpen ? (
                <div className="grid grid-cols-2 gap-4 w-full">
                  <button type="button" onClick={startCamera} className="cursor-pointer flex flex-col items-center justify-center p-6 bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 border-2 border-brand-200 dark:border-brand-800/50 rounded-2xl transition-all group">
                    <div className="bg-white dark:bg-dark-surface p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                    </div>
                    <span className="text-sm font-bold text-brand-700 dark:text-brand-300 text-center leading-tight">Take<br />Photo</span>
                  </button>

                  <label className="cursor-pointer flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 dark:bg-dark-bg dark:hover:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl transition-all group">
                    <input type="file" accept="image/*" onChange={e => setMedProofFile(e.target.files?.[0] || null)} className="hidden" />
                    <div className="bg-white dark:bg-dark-surface p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors" />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 text-center leading-tight">Choose<br />File</span>
                  </label>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center bg-gray-900 dark:bg-black rounded-2xl overflow-hidden relative shadow-inner border border-gray-800">
                  <video ref={videoRef} autoPlay playsInline className="w-full max-h-64 object-cover aspect-video bg-black" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-6 z-10">
                    <button type="button" onClick={stopCamera} className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-3.5 rounded-full shadow-lg transition-transform active:scale-95 border border-white/30">
                      <X className="w-6 h-6" />
                    </button>
                    <button type="button" onClick={captureImage} className="bg-brand-500 hover:bg-brand-400 text-white p-3.5 rounded-full shadow-lg shadow-brand-500/50 transition-transform active:scale-95 border-2 border-white">
                      <Camera className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {medProofFile && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 p-3 rounded-xl flex items-center justify-between text-sm">
                  <span className="font-medium text-green-800 dark:text-green-300 truncate max-w-[250px]">{medProofFile.name}</span>
                  <button type="button" onClick={() => setMedProofFile(null)} className="text-green-600 hover:text-green-800 dark:text-green-400 py-1 px-2">Remove</button>
                </div>
              )}

              <button type="submit" disabled={isUploadingMedProof || !medProofFile} className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 transition-all text-white font-bold py-3.5 rounded-xl disabled:opacity-50 shadow-lg shadow-brand-500/30 active:scale-[0.98] flex justify-center items-center">
                {isUploadingMedProof ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Uploading...</> : 'Submit Proof & Mark Taken'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
