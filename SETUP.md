# ExtintorCheck ARFF — Setup

## 1. Firebase Console
1. Crear proyecto en https://console.firebase.google.com
2. Activar Authentication → Email/Password
3. Crear Firestore Database (modo producción)
4. Activar Storage
5. Copiar credenciales → pegar en `src/firebase.js`

## 2. Primer usuario SuperAdmin (manual)
En Firebase Console → Authentication → Add user:
- Email: tu correo
- Password: la que elijas

Luego en Firestore → Crear documento:
- Colección: `users`
- Document ID: el UID del usuario creado
- Campos:
  ```
  name: "Tu Nombre"
  email: "tu@correo.com"
  role: "superadmin"
  airportCode: "EYP"
  airportName: "El Yopal"
  ```

## 3. Instalar y correr
```bash
npm install
npm run dev
```

## 4. Deploy
```bash
npm run build
# Subir carpeta /dist a Vercel, Netlify o Firebase Hosting
```

## 5. Reglas Firestore
Copiar contenido de `firestore.rules` en Firebase Console → Firestore → Rules

## 6. Flujo día 1 por aeropuerto
1. SuperAdmin crea usuario Admin del aeropuerto
2. Admin registra extintores → genera QR → imprime → pega en extintor
3. Bombero inspector se loguea → Nueva Inspección → escanea QRs → genera PDF

## Estructura Firestore
```
/users/{uid}                              ← todos los usuarios
/airports/{airportCode}/
  extinguishers/{extId}                   ← extintores del aeropuerto
  reports/{reportId}                      ← informes generados
```
