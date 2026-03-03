// @ts-ignore
import webpush from 'web-push';
// @ts-ignore
import type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';

export interface Env {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  FIREBASE_PROJECT_ID: string;
}

async function sendWebPush(subscription: any, payloadStr: string, env: Env) {
  const options = {
    vapidDetails: {
      subject: 'mailto:admin@example.com',
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY
    }
  };

  const reqDetails = webpush.generateRequestDetails(subscription, payloadStr, options);

  return fetch(reqDetails.endpoint, {
    method: reqDetails.method,
    headers: reqDetails.headers,
    body: reqDetails.body as any
  });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '',
        },
      });
    }

    if (request.method === 'POST' && url.pathname === '/notify-caregiver') {
      try {
        const data = await request.json() as any;
        const projectId = env.FIREBASE_PROJECT_ID || "transplantaftercare";

        const patientRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/patients/${data.patientId}`);
        if (!patientRes.ok) return new Response("Patient not found", { status: 404, headers: corsHeaders });
        const patientDoc = await patientRes.json() as any;
        const cgIdsArray = patientDoc.fields?.caregiverIds?.arrayValue?.values || [];

        let notifiedCount = 0;
        const promises = [];

        const pName = patientDoc.fields?.username?.stringValue || "Patient";
        const pPic = patientDoc.fields?.profilePicture?.stringValue || "";

        for (const cgVal of cgIdsArray) {
          const caregiverId = cgVal.stringValue;
          if (!caregiverId) continue;

          // 1. Send push to Caregiver
          const cgRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/caregivers/${caregiverId}`);
          if (cgRes.ok) {
            const cgDoc = await cgRes.json() as any;
            if (cgDoc.fields?.pushSubscription?.stringValue) {
              const sub = JSON.parse(cgDoc.fields.pushSubscription.stringValue);
              promises.push(sendWebPush(sub, JSON.stringify(data), env).catch(e => console.error(e)));
              notifiedCount++;
            }
          }

          // 2. Write UI Notification to the Drawer Database
          const notificationBody: any = {
            fields: {
              userId: { stringValue: caregiverId },
              title: { stringValue: `Medication Taken` },
              message: { stringValue: `${pName} marked ${data.medName} as taken at ${data.time}.` },
              senderName: { stringValue: pName },
              senderPic: { stringValue: pPic },
              read: { booleanValue: false },
              timestamp: { stringValue: new Date().toISOString() }
            }
          };

          if (data.proofUrl) {
            notificationBody.fields.proofUrl = { stringValue: data.proofUrl };
          }

          promises.push(
            fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(notificationBody)
            }).catch(e => console.error("UI Sync Err:", e))
          );
        }

        await Promise.allSettled(promises);

        return new Response(JSON.stringify({ success: true, message: `Caregivers notified: ${notifiedCount}` }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err: any) {
        console.error("Notify endpoint error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response("Worker is running", { status: 200, headers: corsHeaders });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("Running scheduled medication check at", event.cron);

    const projectId = env.FIREBASE_PROJECT_ID || "transplantaftercare";
    const notifiedUserIds = new Set<string>();

    const query = {
      structuredQuery: {
        from: [{ collectionId: "medications" }]
      }
    };

    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
      method: "POST",
      body: JSON.stringify(query)
    });

    const results = await res.json() as any[];
    const allMeds = results.filter(r => r.document).map(r => r.document);

    const nowUtc = new Date();
    // PKT is exactly UTC + 5 hours.
    const nowPkt = new Date(nowUtc.getTime() + (5 * 60 * 60 * 1000));
    const currentHours = nowPkt.getUTCHours();
    const currentMinutes = nowPkt.getUTCMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    // === MIDNIGHT RESET LOGIC ===
    if (currentHours === 0 && currentMinutes === 0) {
      console.log("Midnight PKT reached. Initiating daily medication resets...");

      for (const doc of allMeds) {
        if (!doc.fields || !doc.fields.times) continue;
        const mId = doc.name.split('/').pop();
        const timesArr = doc.fields.times?.arrayValue?.values || [];

        let needsReset = false;
        const resetTimes = timesArr.map((tVal: any) => {
          const tFields = tVal.mapValue.fields;
          if (tFields.taken?.booleanValue || tFields.lastNotified?.stringValue) {
            needsReset = true;
          }
          return {
            mapValue: {
              fields: {
                time: tFields.time,
                taken: { booleanValue: false },
                lastNotified: { stringValue: "" }
              }
            }
          };
        });

        if (needsReset) {
          await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/medications/${mId}?updateMask.fieldPaths=times`, {
            method: "PATCH",
            body: JSON.stringify({
              fields: { ...doc.fields, times: { arrayValue: { values: resetTimes } } }
            })
          }).catch(err => console.error("Reset err", err));
        }
      }
      return;
    }
    // =============================

    for (const medDoc of allMeds) {
      if (!medDoc.fields || !medDoc.fields.times) continue;

      const medId = medDoc.name.split('/').pop();
      const patientId = medDoc.fields.patientId?.stringValue;
      const medName = medDoc.fields.name?.stringValue;

      if (!patientId || !medName) continue;

      let patientData: any = null;

      const timesArr = medDoc.fields.times?.arrayValue?.values || [];
      const updatedTimesArr = [...timesArr];
      let hasUpdates = false;

      for (let i = 0; i < timesArr.length; i++) {
        const tFields = timesArr[i].mapValue.fields;
        const timeStr = tFields.time?.stringValue;
        const isTaken = tFields.taken?.booleanValue;
        const lastNotified = tFields.lastNotified?.stringValue || "";

        if (!timeStr || isTaken) continue;

        const [hoursStr, minutesStr] = timeStr.split(':');
        const medTimeMinutes = parseInt(hoursStr, 10) * 60 + parseInt(minutesStr, 10);
        const minutesDifference = currentTimeMinutes - medTimeMinutes;

        let notificationType: string | null = null;
        let payload: any = {};

        if (minutesDifference >= -10 && minutesDifference < 0 && lastNotified !== "minus10") {
          notificationType = "minus10";
        } else if (minutesDifference >= 0 && minutesDifference < 10 && lastNotified !== "zero") {
          notificationType = "zero";
        } else if (minutesDifference >= 10 && lastNotified !== "plus10") {
          notificationType = "plus10";
        }

        if (notificationType) {
          // Lazy load patient data
          if (!patientData) {
            const patientRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/patients/${patientId}`);
            if (patientRes.ok) patientData = await patientRes.json() as any;
          }

          let caregiverSubs: string[] = [];
          let caregiverIds: string[] = [];

          const cgIdsArray = patientData?.fields?.caregiverIds?.arrayValue?.values || [];
          for (const cgVal of cgIdsArray) {
            const cgId = cgVal.stringValue;
            if (cgId) {
              const cgRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/caregivers/${cgId}`);
              if (cgRes.ok) {
                const cgData = await cgRes.json() as any;
                if (cgData.fields?.pushSubscription?.stringValue) {
                  caregiverSubs.push(cgData.fields.pushSubscription.stringValue);
                  caregiverIds.push(cgId);
                }
              }
            }
          }

          const pSubStr = patientData?.fields?.pushSubscription?.stringValue;

          if (notificationType === "minus10") {
            payload = { type: 'patient-reminder', title: 'Upcoming Medication', body: `Reminder: Take ${medName} at ${timeStr}.`, url: '/' };
          } else if (notificationType === "zero") {
            payload = { type: 'patient-reminder', title: 'Time for Medication', body: `It's time to take your ${medName} (${timeStr}).`, url: '/' };
          } else if (notificationType === "plus10") {
            const pName = patientData?.fields?.username?.stringValue || 'Patient';
            payload = { type: 'missed-medication', title: 'Missed Medication Alert', body: `${pName} missed ${medName} scheduled at ${timeStr}.`, patientName: pName, medName, minutesLate: 10 };
          }

          let senderName = patientData?.fields?.username?.stringValue || "System";
          let senderPic = patientData?.fields?.profilePicture?.stringValue || "";

          const writeUiNotification = (userId: string) => {
            notifiedUserIds.add(userId);
            fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  userId: { stringValue: userId },
                  title: { stringValue: payload.title },
                  message: { stringValue: payload.body },
                  senderName: { stringValue: senderName },
                  senderPic: { stringValue: senderPic },
                  read: { booleanValue: false },
                  timestamp: { stringValue: new Date().toISOString() }
                }
              })
            }).catch(e => console.error("Notification UI Sync Err:", e));
          };

          const promises = [];

          if ((notificationType === "minus10" || notificationType === "zero") && pSubStr) {
            promises.push(sendWebPush(JSON.parse(pSubStr), JSON.stringify(payload), env).catch(e => console.error("Ext PT push err", e)));
            writeUiNotification(patientId);
          } else if (notificationType === "plus10") {
            for (let idx = 0; idx < caregiverSubs.length; idx++) {
              promises.push(sendWebPush(JSON.parse(caregiverSubs[idx]), JSON.stringify(payload), env).catch(e => console.error("Ext CG push err", e)));
              writeUiNotification(caregiverIds[idx]);
            }
          }

          if (promises.length > 0) {
            await Promise.allSettled(promises);
            console.log(`Sent ${notificationType} push for med ${medName} at ${timeStr}`);
          }

          updatedTimesArr[i] = {
            mapValue: {
              fields: {
                time: tFields.time,
                taken: tFields.taken,
                lastNotified: { stringValue: notificationType }
              }
            }
          };
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/medications/${medId}?updateMask.fieldPaths=times`, {
          method: "PATCH",
          body: JSON.stringify({
            fields: { ...medDoc.fields, times: { arrayValue: { values: updatedTimesArr } } }
          })
        }).catch(err => console.error("Patch Error: ", err));
      }
    }
    console.log("Completed medication status check with array times mapping.");

    // === APPOINTMENTS CHECK ===
    const appQuery = {
      structuredQuery: {
        from: [{ collectionId: "appointments" }],
        where: {
          fieldFilter: { field: { fieldPath: "notified" }, op: "EQUAL", value: { booleanValue: false } }
        }
      }
    };
    try {
      const appRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
        method: "POST", body: JSON.stringify(appQuery)
      });
      const appResults = await appRes.json() as any[];
      const upcomingApps = appResults.filter(r => r.document).map(r => r.document);

      const todayYYYYMMDD = [
        nowPkt.getUTCFullYear(),
        String(nowPkt.getUTCMonth() + 1).padStart(2, '0'),
        String(nowPkt.getUTCDate()).padStart(2, '0')
      ].join('-');

      for (const appDoc of upcomingApps) {
        if (!appDoc.fields) continue;

        const appId = appDoc.name.split('/').pop();
        const dateStr = appDoc.fields.date?.stringValue;
        const timeStr = appDoc.fields.time?.stringValue;
        const patientId = appDoc.fields.patientId?.stringValue;
        const title = appDoc.fields.title?.stringValue;

        if (!dateStr || !timeStr || !patientId || !title || dateStr !== todayYYYYMMDD) continue;

        const [aH, aM] = timeStr.split(':');
        const appMinutes = parseInt(aH, 10) * 60 + parseInt(aM, 10);
        const diff = currentTimeMinutes - appMinutes;

        // If appointment is within the next 60 minutes
        if (diff >= -60 && diff < 0) {
          const pRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/patients/${patientId}`);
          if (!pRes.ok) continue;
          const pData = await pRes.json() as any;

          let caregiverSubs: string[] = [];
          let caregiverIds: string[] = [];

          const cgIdsArray = pData.fields?.caregiverIds?.arrayValue?.values || [];
          for (const cgVal of cgIdsArray) {
            const cgId = cgVal.stringValue;
            if (cgId) {
              const cgRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/caregivers/${cgId}`);
              if (cgRes.ok) {
                const cgData = await cgRes.json() as any;
                if (cgData.fields?.pushSubscription?.stringValue) {
                  caregiverSubs.push(cgData.fields.pushSubscription.stringValue);
                  caregiverIds.push(cgId);
                }
              }
            }
          }

          const pSubStr = pData.fields?.pushSubscription?.stringValue;
          const payload = {
            type: 'appointment-reminder',
            title: 'Upcoming Appointment',
            body: `Reminder: ${title} today at ${timeStr}.`,
            url: '/'
          };

          const writeUiNotification = (userId: string) => {
            notifiedUserIds.add(userId);
            fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notifications`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  userId: { stringValue: userId },
                  title: { stringValue: payload.title },
                  message: { stringValue: payload.body },
                  senderName: { stringValue: 'System' },
                  senderPic: { stringValue: '' },
                  read: { booleanValue: false },
                  timestamp: { stringValue: new Date().toISOString() }
                }
              })
            }).catch(e => console.error("Notification UI Sync Err Appt:", e));
          };

          const promises = [];

          if (pSubStr) {
            promises.push(sendWebPush(JSON.parse(pSubStr), JSON.stringify(payload), env).catch(e => console.error("Ext PT push err", e)));
            writeUiNotification(patientId);
          }

          for (let i = 0; i < caregiverSubs.length; i++) {
            promises.push(sendWebPush(JSON.parse(caregiverSubs[i]), JSON.stringify(payload), env).catch(e => console.error("Ext CG push err", e)));
            writeUiNotification(caregiverIds[i]);
          }

          await Promise.allSettled(promises);

          await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/appointments/${appId}?updateMask.fieldPaths=notified`, {
            method: "PATCH",
            body: JSON.stringify({
              fields: { ...appDoc.fields, notified: { booleanValue: true } }
            })
          });
          console.log(`Sent appointment reminder for ${title} to Patient and ${caregiverSubs.length} Caregivers`);
        }
      }
    } catch (err) {
      console.error("Appointments check error: ", err);
    }

    // === ENFORCE 20-NOTIFICATION CAP ===
    for (const uId of notifiedUserIds) {
      try {
        const query = {
          structuredQuery: {
            from: [{ collectionId: "notifications" }],
            where: {
              fieldFilter: { field: { fieldPath: "userId" }, op: "EQUAL", value: { stringValue: uId } }
            },
            orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }]
          }
        };
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
          method: "POST",
          body: JSON.stringify(query)
        });
        const results = await res.json() as any[];
        const docs = results.filter((r: any) => r.document).map((r: any) => r.document);
        if (docs.length > 20) {
          const docsToDelete = docs.slice(20);
          for (const doc of docsToDelete) {
            await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE' }).catch(e => console.error('Del err', e));
          }
        }
      } catch (e) {
        console.error("Cap enforcement err", e);
      }
    }
  }
};