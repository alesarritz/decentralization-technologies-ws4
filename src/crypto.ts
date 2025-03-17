import { webcrypto } from "crypto";
type CK = webcrypto.CryptoKey;

// #############
// ### Utils ###
// #############

// Function to convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

// Function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  var buff = Buffer.from(base64, "base64");
  return buff.buffer.slice(buff.byteOffset, buff.byteOffset + buff.byteLength);
}

// ################
// ### RSA keys ###
// ################

// Generates a pair of private / public RSA keys
type GenerateRsaKeyPair = {
  publicKey: webcrypto.CryptoKey;
  privateKey: webcrypto.CryptoKey;
};

export async function generateRsaKeyPair(): Promise<GenerateRsaKeyPair> {
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}


// Export a crypto public key to a base64 string format
export async function exportPubKey(key: webcrypto.CryptoKey): Promise<string> {
  const exportedKey = await webcrypto.subtle.exportKey("spki", key);
  return arrayBufferToBase64(exportedKey);
}


// Export a crypto private key to a base64 string format
export async function exportPrvKey(key: webcrypto.CryptoKey): Promise<string> {
  if (!key) return "";
  const exportedKey = await webcrypto.subtle.exportKey("pkcs8", key);
  return arrayBufferToBase64(exportedKey);
}

// Import a base64 string public key to its native format
export async function importPubKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(strKey);
  return webcrypto.subtle.importKey(
    "spki",
    keyBuffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt"]
  );
}


// Import a base64 string private key to its native format
export async function importPrvKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(strKey);
  return webcrypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true, // extractable
    ["decrypt"]
  );
}


// Encrypt a message using an RSA public key
export async function rsaEncrypt(
  b64Data: string,
  strPublicKey: string
): Promise<string> {
  const publicKey = await importPubKey(strPublicKey);
  const encodedData = base64ToArrayBuffer(b64Data);

  const encryptedData = await webcrypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encodedData
  );

  const result = arrayBufferToBase64(encryptedData);
  console.log("Encrypted Data:", result); // Debugging output
  return result;
}



// Decrypts a message using an RSA private key
export async function rsaDecrypt(
  encryptedData: string,
  privateKey: webcrypto.CryptoKey
): Promise<string> {
  const encryptedBuffer = base64ToArrayBuffer(encryptedData);
  const decryptedData = await webcrypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedBuffer
  );

  return arrayBufferToBase64(decryptedData);
}


// ######################
// ### Symmetric keys ###
// ######################

// Generates a random symmetric key
export async function createRandomSymmetricKey(): Promise<webcrypto.CryptoKey> {
  return webcrypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}


// Export a crypto symmetric key to a base64 string format
export async function exportSymKey(key: webcrypto.CryptoKey): Promise<string> {
  const exportedKey = await webcrypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(exportedKey);
}


// Import a base64 string format to its crypto native format
export async function importSymKey(strKey: string): Promise<webcrypto.CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(strKey);
  return webcrypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-CBC", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

// Encrypt a message using a symmetric key
export async function symEncrypt(
  key: string | CK,
  data: string
): Promise<string> {
  let cryptoKey: CK;
  if (typeof key === 'string') {
    cryptoKey = await importSymKey(key);
  } else {
    cryptoKey = key;
  }

  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const encoded = new TextEncoder().encode(data);

  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv
    },
    cryptoKey,
    encoded
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return Buffer.from(combined).toString('base64');
}



// Decrypt a message using a symmetric key
export async function symDecrypt(
  key: string | CK,
  encryptedData: string
): Promise<string> {
  let cryptoKey: CK;
  if (typeof key === 'string') {
    cryptoKey = await importSymKey(key);
  } else {
    cryptoKey = key;
  }

  // Decode the concatenated IV + encrypted data
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract IV and encrypted data correctly
  const iv = combined.slice(0, 16);
  const data = combined.slice(16);

  const decrypted = await webcrypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv
    },
    cryptoKey,
    data
  );

  return new TextDecoder().decode(decrypted);
}

