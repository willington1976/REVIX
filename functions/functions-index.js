const { onSchedule } = require('firebase-functions/v2/scheduler')
const { setGlobalOptions } = require('firebase-functions/v2')
const admin = require('firebase-admin')

admin.initializeApp()
const db = admin.firestore()

setGlobalOptions({ region: 'us-central1' })

// Runs every day at 6:00 AM Colombia time (UTC-5 = 11:00 UTC)
exports.checkExtinguisherExpiry = onSchedule('0 11 * * *', async () => {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Date thresholds
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30)
  const in60 = new Date(now); in60.setDate(in60.getDate() + 60)
  const d30 = in30.toISOString().split('T')[0]
  const d60 = in60.toISOString().split('T')[0]

  // Get all airports
  const airportsSnap = await db.collection('airports').listDocuments()
  const alerts = [] // { airportCode, serial, zone, type, field, daysLeft }

  for (const airportRef of airportsSnap) {
    const airportCode = airportRef.id
    const extSnap = await db.collection('airports').doc(airportCode)
      .collection('extinguishers').get()

    for (const extDoc of extSnap.docs) {
      const ext = extDoc.data()

      // Check expiryDate
      if (ext.expiryDate) {
        const diff = Math.ceil((new Date(ext.expiryDate) - now) / (1000*60*60*24))
        if (diff < 0 || diff <= 30 || diff <= 60) {
          alerts.push({
            airportCode,
            serial: ext.serial,
            zone: ext.zone,
            type: 'Agente extintor',
            date: ext.expiryDate,
            daysLeft: diff,
            level: diff < 0 ? 'vencido' : diff <= 30 ? 'critico' : 'advertencia'
          })
        }
      }

      // Check lastHydroTest (every 5 years = 1825 days)
      if (ext.lastHydroTest) {
        const hydroExp = new Date(ext.lastHydroTest)
        hydroExp.setFullYear(hydroExp.getFullYear() + 5)
        const diff = Math.ceil((hydroExp - now) / (1000*60*60*24))
        if (diff < 0 || diff <= 30 || diff <= 60) {
          alerts.push({
            airportCode,
            serial: ext.serial,
            zone: ext.zone,
            type: 'Prueba hidrostática',
            date: hydroExp.toISOString().split('T')[0],
            daysLeft: diff,
            level: diff < 0 ? 'vencido' : diff <= 30 ? 'critico' : 'advertencia'
          })
        }
      }
    }
  }

  if (alerts.length === 0) {
    console.log('No alerts today')
    return
  }

  // Group alerts by airport
  const byAirport = {}
  alerts.forEach(a => {
    if (!byAirport[a.airportCode]) byAirport[a.airportCode] = []
    byAirport[a.airportCode].push(a)
  })

  // Get all users with FCM tokens
  const usersSnap = await db.collection('users').get()

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data()
    if (!user.fcmToken) continue
    if (user.active === false) continue

    // Determine which airports this user sees
    const userAirports = user.role === 'superadmin'
      ? Object.keys(byAirport)
      : [user.airportCode]

    const userAlerts = userAirports
      .flatMap(code => byAirport[code] || [])

    if (userAlerts.length === 0) continue

    const vencidos  = userAlerts.filter(a => a.level === 'vencido').length
    const criticos  = userAlerts.filter(a => a.level === 'critico').length
    const advertencias = userAlerts.filter(a => a.level === 'advertencia').length

    let title, body
    if (vencidos > 0) {
      title = `🔴 REVIX — ${vencidos} extintor${vencidos>1?'es':''} VENCIDO${vencidos>1?'S':''}`
      body = `Requiere acción inmediata en ${userAirports.join(', ')}`
    } else if (criticos > 0) {
      title = `🟠 REVIX — ${criticos} extintor${criticos>1?'es':''} por vencer`
      body = `Menos de 30 días para vencer en ${userAirports.join(', ')}`
    } else {
      title = `🟡 REVIX — ${advertencias} extintor${advertencias>1?'es':''} próximos a vencer`
      body = `Entre 30 y 60 días para vencer`
    }

    try {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title, body },
        data: { airportCode: user.airportCode, type: 'expiry_alert' },
        android: {
          notification: {
            channelId: 'revix-alerts',
            priority: vencidos > 0 ? 'high' : 'default',
            color: vencidos > 0 ? '#DC2626' : criticos > 0 ? '#D97706' : '#2563EB'
          }
        },
        apns: {
          payload: {
            aps: {
              badge: userAlerts.length,
              sound: vencidos > 0 ? 'default' : null
            }
          }
        }
      })
      console.log(`Notification sent to ${user.email}`)
    } catch (err) {
      // Token expired — remove it
      if (err.code === 'messaging/registration-token-not-registered') {
        await db.collection('users').doc(userDoc.id).update({ fcmToken: null })
      }
      console.error(`Error sending to ${user.email}:`, err.message)
    }
  }

  // Save alerts summary to Firestore for dashboard banner
  await db.collection('system').doc('alerts').set({
    date: today,
    alerts,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  })

  console.log(`Done. ${alerts.length} alerts processed for ${Object.keys(byAirport).length} airports.`)
})
