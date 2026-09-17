// Encode payload into QR string
export function encodeQRPayload(airportCode, extinguisherId) {
  return `ARFF:${airportCode}:${extinguisherId}`
}

// Decode QR string back to { airportCode, extinguisherId }
export function decodeQRPayload(raw) {
  if (!raw || !raw.startsWith('ARFF:')) return null
  const parts = raw.split(':')
  if (parts.length !== 3) return null
  return { airportCode: parts[1], extinguisherId: parts[2] }
}
