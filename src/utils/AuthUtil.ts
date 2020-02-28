import crypto from 'crypto'
import base64url from 'base64url'
import cbor from 'cbor'
import { Certificate } from '@fidm/x509'

// https://github.com/fido-alliance/webauthn-demo/blob/master/utils.js

export function verifySignature(
  signature: Buffer,
  data: Buffer,
  publicKey: string
): Boolean {
  return crypto
    .createVerify('SHA256')
    .update(data)
    .verify(publicKey, signature)
}

export function randomBase64URLBuffer(len?: number): string {
  len = len || 32
  let buf = crypto.randomBytes(len)
  return base64url(buf)
}

export function generateServerMakeCredRequest(
  username: string,
  displayName: string,
  id: string
) {
  return {
    challenge: randomBase64URLBuffer(32),
    rp: {
      name: 'Mirage'
    },
    user: {
      id,
      name: username,
      displayName
    },
    attestation: 'direct',
    pubKeyCredParams: [
      {
        type: 'public-key',
        alg: -7 // "ES256" IANA COSE Algorithms registry
      }
    ]
  }
}

interface Authenticator {
  credID: string
}

export function generateServerGetAssertion(authenticators: Authenticator[]) {
  let allowCredentials = []
  for (let authr of authenticators) {
    allowCredentials.push({
      type: 'public-key',
      id: authr.credID,
      transports: ['usb', 'nfc', 'ble']
    })
  }
  return {
    challenge: randomBase64URLBuffer(32),
    allowCredentials
  }
}
